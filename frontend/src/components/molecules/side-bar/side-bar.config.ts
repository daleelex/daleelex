import { Route } from '../../../configs/enums';
import {
  HomeIcon, CatalogIcon, TeamsIcon, DocsIcon, HealthIcon,
} from './side-bar.icons';
import type { SidebarItem } from './side-bar.types';

export const sidebarItems: SidebarItem[] = [
  { text: 'Home', type: 'navigation', route: Route.HOME, icon: HomeIcon },
  { text: 'Catalog', type: 'navigation', route: Route.SERVICES, icon: CatalogIcon },
  { text: 'Teams', type: 'navigation', route: Route.TEAMS, icon: TeamsIcon },
  { text: 'TechDocs', type: 'navigation', route: Route.DOCS, icon: DocsIcon },
  { text: 'Health & SLO', type: 'navigation', route: Route.HEALTH, icon: HealthIcon },
];