import React from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';

import { isEmpty } from '../../utils/helpers';
import './TableComponent.scss';

const TableComponent = ({ data = [], fields = [], onRowClick, bodyTemplate, maxTableRows = 8, children }) => {
  return (
    <div className="common-table-component">
      <DataTable
        value={isEmpty(data) ? [] : data}
        onRowClick={onRowClick}
        paginator
        rows={maxTableRows}
      >
        {
          fields.map(({ field, header }) => (
            <Column key={field} field={field} header={header} body={bodyTemplate} />
          ))
        }
        {children}
      </DataTable>
    </div>
  )
};

export default TableComponent;