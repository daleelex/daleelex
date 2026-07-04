import type { FC, ReactElement } from 'react';

export type IconType = FC<any> | ReactElement;

export interface SidebarItem {
  text: string;
  type: 'navigation' | 'group';
  route?: string;
  icon?: IconType;
  children?: SidebarItem[];
}

export interface SidebarProps {
  items?: SidebarItem[];
  version?: string;
}