import React from 'react';
import { BrandDetailClient } from './brand-detail-client';

export function generateStaticParams() {
  return [{ id: '_placeholder' }];
}

export default function MasterBrandDetailPage() {
  return <BrandDetailClient />;
}
