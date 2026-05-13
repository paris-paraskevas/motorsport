import { SeriesCategory, SeriesMeta } from './types';

export interface CategoryDef {
  id: SeriesCategory;
  label: string;
}

// Display order in the drawer (top to bottom).
export const CATEGORIES: CategoryDef[] = [
  { id: 'formula', label: 'Formula' },
  { id: 'endurance', label: 'Endurance' },
  { id: 'gt', label: 'GT' },
  { id: 'motorcycle', label: 'Motorcycles' },
  { id: 'rally', label: 'Rally' },
  { id: 'stock', label: 'Stock Cars' },
];

export interface GroupedSeries {
  category: CategoryDef;
  series: SeriesMeta[];
}

export function groupSeriesByCategory(seriesList: SeriesMeta[]): GroupedSeries[] {
  return CATEGORIES.map(category => ({
    category,
    series: seriesList.filter(s => s.category === category.id),
  })).filter(g => g.series.length > 0);
}
