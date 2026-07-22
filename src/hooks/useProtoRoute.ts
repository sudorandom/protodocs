import { useLocation } from 'react-router-dom';

export interface RouteState {
  packagePath: string;
  symbolPath: string;
  activeTab: 'files' | 'services';
  searchQuery: string;
}

export function useProtoRoute(): RouteState {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const path = location.pathname.replace(/^\/+/, '');

  let packagePath = '';
  let symbolPath = '';

  if (path) {
    const parts = path.split('/');
    if (parts.length > 0) {
      packagePath = parts[0];
    }
    if (parts.length > 1) {
      symbolPath = parts.slice(1).join('/');
    }
  }

  const tabParam = searchParams.get('tab');
  const activeTab: 'files' | 'services' = tabParam === 'services' ? 'services' : 'files';
  const searchQuery = searchParams.get('q') || '';

  return {
    packagePath,
    symbolPath,
    activeTab,
    searchQuery,
  };
}
