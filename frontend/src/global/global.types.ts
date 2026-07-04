export type Localization = {
  en: string;
  ar: string;
  fr: string;
};

type ComponentAction = {
  onClick?: () => void;
  onChange?: () => void;
  onSubmit?: () => void;
};

export interface GridHeaderProps {
  globalFilter: string;
  selectedItems: never[];
  addActions?: ComponentAction;
  deleteAction?: ComponentAction;
}

export type CustomSidebarHeaderProps = {
  onClose: () => void;
};

export type sidebarLinkItemType = {
  text: string;
  route: string;
  onChangeSelectedItem: (arg0: number) => void;
  index: number;
  selected?: boolean;
  icon?: string;
};
