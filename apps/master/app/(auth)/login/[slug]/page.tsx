import React from 'react';
import { MasterSlugLoginClient } from './slug-redirect-client';

export function generateStaticParams() {
  return [{ slug: '_placeholder' }];
}

export default function MasterSlugLoginPage() {
  return <MasterSlugLoginClient />;
}
