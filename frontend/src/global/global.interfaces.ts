export interface GridHeaderProps {
  globalFilter: string | null;
  setGlobalFilter: (val: string) => void;
  onExport: () => void;
}

export interface AlarmData {
  alarmName: string;
  metricName: string;
  stateValue: 'ALARM' | 'OK' | 'INSUFFICIENT_DATA';
  threshold: string;
  lastUpdated: string;
  accountId: string;
  client: string;
  instance: string;
  status: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  category: string;
  unitPrice: number;
  inventoryStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

export interface InventoryGridHeaderProps {
  globalFilter: string;
  setGlobalFilter: (val: string) => void;
  selectedItems: InventoryItem[];
  addActions: { onClick: () => void };
  deleteAction: { onClick: () => void };
  onExport: () => void;
}

export interface Release {
  id: string;
  version: string;
  type: 'Major' | 'Minor' | 'Patch';
  date: string;
  status: 'Released' | 'In Development' | 'Code Freeze' | 'DEV';
}

export interface Product {
  id: string;
  name: string;
  version: string;
  status: 'Released' | 'In Development' | 'Code Freeze' | 'DEV';
  releases: Release[];
}
