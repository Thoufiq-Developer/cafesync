import React from 'react';
import { ThemeStudioPageClient } from './theme-studio-client-page';

export function generateStaticParams() {
  return [{ id: '_placeholder' }];
}

export default function BrandThemeStudioPage() {
  return <ThemeStudioPageClient />;
}
