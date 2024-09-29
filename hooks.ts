import { useEffect, useState, useRef } from 'react';
import { getDifferingRowIndexes } from 'utils';
import { filterDataByTime } from './utils';
import { BlinkOptions, Primitive } from 'types';
// import { eventBus } from '@grafana/runtime';

export const useBlinkingCells = (
  eventBus: any,
  cDS: any,
  dataSeries: any,
  blink: BlinkOptions,
  columns: string[],
  visibleColumns: string[],
  pDS: any,
  visibleRows: Primitive[][],
  id: number,
  title: string
) => {
  const [blinkingCells, setBlinkingCells] = useState<{ [key: string]: boolean }>({});
  const timersRef = useRef<{ [key: string]: { intervalId: number; timeoutId: number } }>({});
  const init = useRef<boolean>(true);

  const startBlinking = (
    cellKey: string,
    duration: number,
    columnName = '',
    id: number | null = null,
    title: string = ''
  ) => {
    if (timersRef.current[cellKey]) {
      clearInterval(timersRef.current[cellKey].intervalId);
      clearTimeout(timersRef.current[cellKey].timeoutId);
    }
    const intervalId = setInterval(() => {
      setBlinkingCells((prev) => ({
        ...prev,
        [cellKey]: !prev[cellKey],
      }));
    }, 1000) as unknown as number;
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      setBlinkingCells((prev) => ({
        ...prev,
        [cellKey]: false,
      }));
      localStorage.removeItem(`${window?.location?.pathname?.split('/')?.slice(-1)[0]}-${id}-${title}-${columnName}`);
      delete timersRef.current[cellKey];
    }, duration * 60 * 1000) as unknown as number;
    timersRef.current[cellKey] = { intervalId, timeoutId };
  };

  const handleBlinking = (indexes: number[][], indexCol: number, columnName: string, id: number, title: string) => {
    indexes?.forEach((index: number[]) => {
      if (index[1] === indexCol) {
        startBlinking(`compare-${visibleColumns[index[1]]}-${index[0]}`, 10, columnName, id, title);
      }
    });
  };

  useEffect(() => {
    if (blink?.length && columns && visibleColumns?.length) {
      const newBlink: BlinkOptions | any = { ...blink[0] };
      columns?.forEach((columnName) => {
        if (newBlink[columnName]) {
          const { value, operator, time, compareWithPrevious } = newBlink[columnName];
          if (compareWithPrevious) {
            const indexCol = columns?.indexOf(columnName);
            const indexes = getDifferingRowIndexes(cDS, pDS);
            if (indexes?.length > 0) {
              localStorage.setItem(
                `${window?.location?.pathname?.split('/')?.slice(-1)[0]}-${id}-${title}-${columnName}`,
                JSON.stringify(indexes)
              );
              handleBlinking(indexes, indexCol, columnName, id, title);
            } else if (
              localStorage.getItem(
                `${window?.location?.pathname?.split('/')?.slice(-1)[0]}-${id}-${title}-${columnName}`
              ) &&
              init.current
            ) {
              const storedData = localStorage.getItem(
                `${window?.location?.pathname?.split('/')?.slice(-1)[0]}-${id}-${title}-${columnName}`
              );
              const parsedArray = JSON.parse(storedData as string);
              const indexCol = columns?.indexOf(columnName);
              if (Array.isArray(parsedArray)) {
                handleBlinking(parsedArray, indexCol, columnName, id, title);
              }
              init.current = false;
            }
          } else {
            const filterDataBlink = filterDataByTime(dataSeries, time, columnName, operator, value);
            visibleRows?.forEach((_, index) => {
              if (filterDataBlink && filterDataBlink.isConditionMet) {
                startBlinking(`${columnName}-${index}`, filterDataBlink.minutes as number);
              }
            });
          }
        }
      });
    }
  }, [dataSeries, columns, visibleColumns]);

  useEffect(() => {
    const subscription = eventBus.subscribe({ type: 'render' }, () => {});

    return () => {
      subscription.unsubscribe();
      Object.values(timersRef.current).forEach(({ intervalId, timeoutId }) => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      });
      timersRef.current = {};
    };
  }, []);
  return { blinkingCells };
};
