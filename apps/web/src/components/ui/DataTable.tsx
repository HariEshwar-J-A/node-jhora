import type { ReactNode } from 'react';

export type DataColumn<T> = {
    key: string;
    header: string;
    render: (row: T) => ReactNode;
    className?: string;
};

type Props<T> = {
    columns: DataColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    testId?: string;
    compact?: boolean;
    /** Long tables scroll inside a capped height on small screens (header stays pinned). */
    capped?: boolean;
};

export function DataTable<T>({ columns, rows, rowKey, testId, compact, capped }: Props<T>) {
    return (
        <div
            className={`data-table-wrap${compact ? ' data-table-wrap--compact' : ''}${capped ? ' data-table-wrap--capped' : ''}`}
        >
            <table className="data" data-testid={testId}>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} className={c.className}>
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={rowKey(row)}>
                            {columns.map((c) => (
                                <td key={c.key} className={c.className}>
                                    {c.render(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
