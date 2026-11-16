import BrandSlugLoginClient from './brand-slug-login-client';

export function generateStaticParams() {
  return [{ slug: '_placeholder' }];
}

export default function BrandSlugLoginPage() {
  return <BrandSlugLoginClient />;
}
