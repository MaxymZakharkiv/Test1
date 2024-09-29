import React, { useState, useEffect, useRef } from 'react';
import { DataFrame, PanelProps } from '@grafana/data';
import { SimpleOptions } from 'types';
import { PanelDataErrorView } from '@grafana/runtime';
import { Table, TableBody, TableContainer, TableHead, TableRow, TableCell } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { Tooltip, IconButton } from '@mui/material';

import type { SizeObj, ProcessedData, Primitive } from '../types';
import { processData, getTimestamps, sanitizeRows, applyRounding, generateCsvContent } from '../utils';
import { TableHeadCell } from 'components/table/TableHeadCell';
import { TableBodyRow } from 'components/table/TableBodyRow';
import { useBlinkingCells } from 'hooks';

interface Props extends PanelProps<SimpleOptions> {}

export const TablePanel: React.FC<Props> = (props) => {
  console.log(props);
  const { options, data, width, height, fieldConfig, id, onOptionsChange, title, eventBus } = props;
  let {
    hideShowColumns,
    hideShowRows,
    rowColor,
    align,
    valueMappings,
    blink,
    rounding,
    heightData,
    firstCell,
    fontSizeText,
    fontSizePanelTitle,
    downloadCsv,
    hideTitle,
    hideEmptyRows,
    fontSizeHeaderTable,
    isChartModalEditor,
    chartModalEditor,
    isShowPoints,
  } = options;

  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Primitive[][]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [visibleRows, setVisibleRows] = useState<Primitive[][]>([]);
  const [rowHeights, setRowHeights] = useState<SizeObj>(heightData);
  const [pData, setPData] = useState<ProcessedData>();
  const [cData, setCData] = useState<ProcessedData>();

  const prevDataSeriesRef = useRef<DataFrame[]>(data.series);

  useEffect(() => {
    prevDataSeriesRef.current = data.series;
  }, [data.series]);

  const prevDataSeries = prevDataSeriesRef.current;

  useEffect(() => {
    const headerElements = document.querySelectorAll('div[data-testid="header-container"]');
    headerElements.forEach((element) => {
      const h2Element = element.querySelector('h2');
      if (h2Element) {
        h2Element.style.display = hideTitle ? 'none' : 'flex';
        h2Element.style.fontSize = `${fontSizePanelTitle}px`;
      }
    });
  }, [fontSizePanelTitle, hideTitle]);

  useEffect(() => {
    const { headers, rows: info } = processData(data.series);
    setColumns(headers as string[]);
    setRows(info);
    setPData(processData(prevDataSeries));
    setCData(processData(data.series));
  }, [data.series]);

  useEffect(() => {
    if (rows.length) {
      const heightRows = rows.reduce(
        (acc, [rowKey]) => ({
          ...acc,
          [rowKey as string]: 50,
        }),
        {}
      );
      setRowHeights({ ...heightRows, ...heightData });
    }
  }, [rows, width]);

  useEffect(() => {
    setVisibleColumns(
      hideShowColumns.length > 0 ? ['', ...columns.filter((col) => hideShowColumns.includes(col))] : columns
    );
  }, [hideShowColumns, columns]);

  useEffect(() => {
    setVisibleRows(
      hideShowRows.length > 0 ? rows.filter((row) => row.length > 0 && hideShowRows.includes(row[0] as string)) : rows
    );
  }, [rows, hideShowRows]);

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  const exportCsv = () => {
    const { firstDate, lastDate } = getTimestamps(data.series);
    const { headers, rows } = processData(data.series);
    let sanitizedRows = sanitizeRows(rows, headers, valueMappings);
    const newSanitizedRows = applyRounding(sanitizedRows, headers, rounding);
    const csvContent = generateCsvContent(headers, newSanitizedRows, firstDate, lastDate);
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const filename = `${props.title}.csv`;
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.setAttribute('download', filename);
      link.download = filename;
      link.click();
      setTimeout(function () {
        window.URL.revokeObjectURL(url);
      }, 100);
    }
  };

  const { blinkingCells } = useBlinkingCells(
    eventBus,
    cData,
    data.series,
    blink,
    columns,
    visibleColumns,
    pData,
    visibleRows,
    id,
    title
  );

  return (
    <div>
      <TableContainer
        id="table-container"
        sx={{
          maxHeight: height,
          maxWidth: width,
          overflowY: 'auto',
          overflowX: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {downloadCsv && (
          <div style={{ textAlign: 'right' }}>
            <Tooltip title="Download data">
              <IconButton disabled={!data.series} aria-label="download" onClick={exportCsv}>
                <DownloadIcon
                  sx={{
                    color: data.series ? 'white' : 'grey',
                  }}
                />
              </IconButton>
            </Tooltip>
          </div>
        )}

        <Table
          sx={{
            backgroundColor: '#2e2e2e',
            color: '#fff',
            width: '100%',
            boxSizing: 'border-box',
          }}
          aria-label="simple table"
        >
          <TableHead>
            <TableRow
              sx={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                borderTop: '1px solid white',
              }}
            >
              <TableCell
                align={align}
                sx={{
                  height: '30px',
                  position: 'relative',
                  minWidth: 20,
                  fontSize: `${fontSizeHeaderTable > 8 ? fontSizeHeaderTable : 8}px`,
                  width: 'auto',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'normal',
                  color: 'white',
                  padding: 0,
                  paddingLeft: 1,
                  paddingRight: 1,
                  wordWrap: 'break-word',
                  wordBreak: 'break-word',
                  borderRight: '1px solid white',
                  border: '1px solid white',
                }}
              >
                {firstCell}
              </TableCell>
              {visibleColumns.slice(1).map((column, index) => (
                <TableHeadCell fontSize={fontSizeHeaderTable} key={index} column={column} align={align} />
              ))}
            </TableRow>
          </TableHead>
          <TableBody sx={{ boxSizing: 'border-box' }}>
            {visibleRows?.map((row, index) => (
              <TableBodyRow
                isShowPoints={isShowPoints}
                isChartModalEditor={isChartModalEditor}
                chartModalEditor={chartModalEditor}
                hideEmptyRows={hideEmptyRows}
                key={index}
                data={data.series}
                index={index}
                fontSize={fontSizeText}
                rounding={rounding}
                row={row}
                rowColor={rowColor}
                rowHeights={rowHeights}
                align={align}
                columns={columns}
                valueMappings={valueMappings}
                blinkingCells={blinkingCells}
                // blinkingCells={{}}
                heightData={heightData}
                visibleColumns={visibleColumns}
                onOptionsChange={onOptionsChange}
                options={options}
                setRowHeights={setRowHeights}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};
