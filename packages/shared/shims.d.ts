// Type declarations for modules injected by consuming apps at runtime
declare module '@/app/(auth)/login/password-actions' {
  export const completeFirstLoginPasswordChangeAction: any;
}

declare module '@/app/admin/actions' {
  export const saveItemAction: any;
  export const toggleItemStatusAction: any;
  export const promoteItemBrandWideAction: any;
}

declare module '@/app/shop/actions' {
  export const saveShopItemAction: any;
  export const toggleShopItemStatusAction: any;
}

declare module '@/components/shop/shop-mobile-nav' {
  export const ShopMobileNav: any;
}

