/**
 * Branded A4 Portrait PDF generators for Shop Credentials:
 * 1) One-time Single-Shop Credentials slip (only at creation / password reset)
 * 2) Bulk Credentials Sheet for all shops (username + login link only, NO passwords)
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
} from '@react-pdf/renderer';
import { ensureContrastColor, pickReadableTextColor } from '../theme/colors';

export interface CredentialsPdfBrandMeta {
  name: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  slug: string;
  generatedAt: string;
  footerText?: string | null;
}

export interface SingleShopCredentialPdfPayload {
  brand: CredentialsPdfBrandMeta;
  shopName: string;
  shopCode: string;
  managerName: string;
  username: string;
  temporaryPassword: string;
  loginUrl: string;
}

export interface BulkCredentialsRow {
  shopName: string;
  shopCode: string;
  status: string;
  managerName: string;
  username: string;
  loginUrl: string;
}

export interface BulkCredentialsPdfPayload {
  brand: CredentialsPdfBrandMeta;
  rows: BulkCredentialsRow[];
}

function createStyles(primaryColor: string) {
  const safeTitle = ensureContrastColor(primaryColor, '#ffffff', 4.5);
  const badgeFg = pickReadableTextColor(primaryColor, '#ffffff', '#0f172a');

  return StyleSheet.create({
    page: {
      paddingTop: 36,
      paddingBottom: 52,
      paddingHorizontal: 36,
      fontSize: 9,
      fontFamily: 'Helvetica',
      color: '#1f2937',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1.5,
      borderBottomColor: primaryColor,
      paddingBottom: 12,
      marginBottom: 18,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 6,
      objectFit: 'contain',
    },
    monogram: {
      width: 44,
      height: 44,
      borderRadius: 6,
      backgroundColor: primaryColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monogramText: {
      fontSize: 18,
      fontFamily: 'Helvetica-Bold',
      color: badgeFg,
    },
    brandName: {
      fontSize: 15,
      fontFamily: 'Helvetica-Bold',
      color: safeTitle,
    },
    sub: {
      fontSize: 8,
      color: '#6b7280',
      marginTop: 2,
    },
    card: {
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 6,
      padding: 16,
      backgroundColor: '#f8fafc',
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    fieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
      paddingVertical: 7,
    },
    fieldLabel: {
      fontSize: 8.5,
      color: '#64748b',
      width: '34%',
    },
    fieldValue: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: '#0f172a',
      width: '66%',
    },
    noticeBox: {
      borderWidth: 1,
      borderColor: '#f59e0b',
      backgroundColor: '#fffbeb',
      borderRadius: 6,
      padding: 10,
      marginBottom: 16,
    },
    noticeText: {
      fontSize: 8.5,
      color: '#78350f',
      lineHeight: 1.4,
    },
    table: {
      borderWidth: 0.6,
      borderColor: '#e2e8f0',
      borderRadius: 4,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: primaryColor,
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    th: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: badgeFg,
    },
    tr: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
      paddingVertical: 5,
      paddingHorizontal: 6,
    },
    trAlt: {
      flexDirection: 'row',
      backgroundColor: '#f8fafc',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e2e8f0',
      paddingVertical: 5,
      paddingHorizontal: 6,
    },
    td: {
      fontSize: 8,
      color: '#1e293b',
    },
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 36,
      right: 36,
      borderTopWidth: 0.5,
      borderTopColor: '#e2e8f0',
      paddingTop: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerText: {
      fontSize: 7.5,
      color: '#94a3b8',
    },
  });
}

function PdfBrandHeader({
  brand,
  title,
  styles,
}: {
  brand: CredentialsPdfBrandMeta;
  title: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const isSafeRaster =
    typeof brand.logoUrl === 'string' && brand.logoUrl.startsWith('data:image/');

  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        {isSafeRaster && brand.logoUrl ? (
          <Image style={styles.logo} src={brand.logoUrl} />
        ) : (
          <View style={styles.monogram}>
            <Text style={styles.monogramText}>
              {(brand.name || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View>
          <Text style={styles.brandName}>{brand.name}</Text>
          <Text style={styles.sub}>Portal: /login/{brand.slug}</Text>
        </View>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
          {title}
        </Text>
        <Text style={styles.sub}>Generated: {brand.generatedAt}</Text>
      </View>
    </View>
  );
}

export async function generateSingleCredentialPdf(
  payload: SingleShopCredentialPdfPayload
): Promise<Buffer> {
  const styles = createStyles(payload.brand.primaryColor || '#ea580c');

  const doc = (
    <Document title={`${payload.shopName} - Manager Login Credentials`}>
      <Page size="A4" style={styles.page}>
        <PdfBrandHeader
          brand={payload.brand}
          title="MANAGER LOGIN CREDENTIALS"
          styles={styles}
        />

        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            ONE-TIME SECURITY SLIP: Share this slip privately with {payload.managerName}. Plain-text
            passwords are never stored in the database and will not be shown again. The manager will
            be required to choose a new personal password on their very first login.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shop Access Details</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Shop Name</Text>
            <Text style={styles.fieldValue}>
              {payload.shopName} ({payload.shopCode})
            </Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Manager</Text>
            <Text style={styles.fieldValue}>{payload.managerName}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Login Link</Text>
            <Text style={styles.fieldValue}>{payload.loginUrl}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Username</Text>
            <Text style={styles.fieldValue}>{payload.username}</Text>
          </View>
          <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.fieldLabel}>One-Time Password</Text>
            <Text style={styles.fieldValue}>{payload.temporaryPassword}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {payload.brand.footerText || `${payload.brand.name} • Powered by CafeLedger`}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}

export async function generateBulkCredentialsSheetPdf(
  payload: BulkCredentialsPdfPayload
): Promise<Buffer> {
  const styles = createStyles(payload.brand.primaryColor || '#ea580c');

  const doc = (
    <Document title={`${payload.brand.name} - Bulk Shop Login Sheet`}>
      <Page size="A4" style={styles.page}>
        <PdfBrandHeader
          brand={payload.brand}
          title="SHOP LOGIN DIRECTORY"
          styles={styles}
        />

        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>
            SECURITY NOTE: Existing manager passwords are stored as secure hashes and cannot be
            recovered. This directory lists each shop&apos;s manager username and branded login URL.
            Use &quot;Reset password&quot; from the Shops list if a manager needs a fresh one-time password.
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: '23%' }]}>Shop</Text>
            <Text style={[styles.th, { width: '13%' }]}>Code</Text>
            <Text style={[styles.th, { width: '18%' }]}>Manager</Text>
            <Text style={[styles.th, { width: '19%' }]}>Username</Text>
            <Text style={[styles.th, { width: '27%' }]}>Login URL</Text>
          </View>

          {payload.rows.length === 0 ? (
            <View style={styles.tr}>
              <Text style={[styles.td, { width: '100%' }]}>
                No shops or manager logins found for this brand yet.
              </Text>
            </View>
          ) : (
            payload.rows.map((row, idx) => (
              <View key={idx} style={idx % 2 === 0 ? styles.tr : styles.trAlt}>
                <Text style={[styles.td, { width: '23%' }]}>{row.shopName}</Text>
                <Text style={[styles.td, { width: '13%' }]}>{row.shopCode}</Text>
                <Text style={[styles.td, { width: '18%' }]}>{row.managerName}</Text>
                <Text style={[styles.td, { width: '19%', fontFamily: 'Helvetica-Bold' }]}>
                  {row.username}
                </Text>
                <Text style={[styles.td, { width: '27%' }]}>{row.loginUrl}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {payload.brand.footerText || `${payload.brand.name} • Powered by CafeLedger`}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
