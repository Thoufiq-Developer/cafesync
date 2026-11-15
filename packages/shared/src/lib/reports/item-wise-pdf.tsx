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
import {
  GroupedItemDetailsGroup,
  ItemWiseSummaryResult,
} from './item-wise';
import { formatINR } from '../calculations/currency';
import { formatCount } from '../calculations/format';
import { formatQuantityWithUnit } from '../constants/units';
import { formatDate, getTodayKolkata } from '../calculations/dates';
import { ensureContrastColor, pickReadableTextColor } from '../theme/colors';

function createItemPdfStyles(primaryColor: string = '#ea580c') {
  const safeAccent = ensureContrastColor(primaryColor, '#ffffff', 4.5);
  const badgeFg = pickReadableTextColor(primaryColor, '#ffffff', '#0f172a');

  return StyleSheet.create({
    page: {
      paddingTop: 34,
      paddingBottom: 52,
      paddingHorizontal: 32,
      fontSize: 8.5,
      fontFamily: 'Helvetica',
      color: '#1f2937',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1.5,
      borderBottomColor: primaryColor,
      paddingBottom: 10,
      marginBottom: 14,
    },
    headerCentered: {
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      borderBottomWidth: 1.5,
      borderBottomColor: primaryColor,
      paddingBottom: 10,
      marginBottom: 14,
      gap: 5,
    },
    brandBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandBlockCentered: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 6,
      objectFit: 'contain',
    },
    monogramBox: {
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
    brandTitle: {
      fontSize: 15,
      fontFamily: 'Helvetica-Bold',
      color: safeAccent,
    },
    brandSub: {
      fontSize: 7.5,
      color: '#6b7280',
      marginTop: 1.5,
    },
    metaRight: {
      alignItems: 'flex-end',
    },
    metaCentered: {
      alignItems: 'center',
    },
    reportTitle: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      textTransform: 'uppercase',
    },
    metaText: {
      fontSize: 7.8,
      color: '#4b5563',
      marginTop: 1.5,
    },
    cardsContainer: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 14,
    },
    card: {
      flex: 1,
      padding: 8,
      backgroundColor: '#f9fafb',
      borderRadius: 4,
      borderWidth: 0.8,
      borderColor: '#e5e7eb',
    },
    cardHighlight: {
      flex: 1,
      padding: 8,
      backgroundColor: '#fff7ed',
      borderRadius: 4,
      borderWidth: 1,
      borderColor: primaryColor,
    },
    cardLabel: {
      fontSize: 7,
      color: '#6b7280',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    cardValue: {
      fontSize: 10.5,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 5,
      borderBottomWidth: 0.8,
      borderBottomColor: '#e5e7eb',
      paddingBottom: 3,
    },
    sectionTitle: {
      fontSize: 9.5,
      fontFamily: 'Helvetica-Bold',
      color: safeAccent,
      textTransform: 'uppercase',
    },
    table: {
      width: '100%',
      marginBottom: 10,
      borderWidth: 0.6,
      borderColor: '#e5e7eb',
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      borderBottomWidth: 0.8,
      borderBottomColor: '#d1d5db',
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    tableHeaderCell: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 7.2,
      color: '#374151',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#f3f4f6',
      paddingVertical: 3.5,
      paddingHorizontal: 4,
    },
    tableRowAlt: {
      flexDirection: 'row',
      backgroundColor: '#fafafa',
      borderBottomWidth: 0.5,
      borderBottomColor: '#f3f4f6',
      paddingVertical: 3.5,
      paddingHorizontal: 4,
    },
    tableCell: {
      fontSize: 7.3,
      color: '#1f2937',
    },
    tableCellRight: {
      fontSize: 7.3,
      color: '#1f2937',
      textAlign: 'right',
    },
    tableTotalRow: {
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      borderTopWidth: 1,
      borderTopColor: '#d1d5db',
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    tableTotalCell: {
      fontSize: 7.6,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
    },
    tableTotalCellRight: {
      fontSize: 7.6,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      textAlign: 'right',
    },
    footer: {
      position: 'absolute',
      bottom: 18,
      left: 32,
      right: 32,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 0.5,
      borderTopColor: '#e5e7eb',
      paddingTop: 5,
    },
    footerText: {
      fontSize: 7,
      color: '#9ca3af',
    },
  });
}

function PdfBrandHeader({
  summary,
  title,
  generatedAt,
  styles,
}: {
  summary: ItemWiseSummaryResult;
  title: string;
  generatedAt: string;
  styles: ReturnType<typeof createItemPdfStyles>;
}) {
  const { brand } = summary;
  const isCentered = brand.pdfHeaderStyle === 'centered';
  const showReg = brand.pdfShowRegistrationNo !== false;
  const showGstin = brand.pdfShowGstin !== false;
  const showAddress = brand.pdfShowAddress !== false;
  const isSafeRaster =
    typeof brand.logoUrl === 'string' && brand.logoUrl.startsWith('data:image/');

  const regParts: string[] = [];
  if (showReg && brand.registrationNo) regParts.push(`Reg: ${brand.registrationNo}`);
  if (showGstin && brand.gstin) regParts.push(`GSTIN: ${brand.gstin}`);

  return (
    <View style={isCentered ? styles.headerCentered : styles.headerRow}>
      <View style={isCentered ? styles.brandBlockCentered : styles.brandBlock}>
        {isSafeRaster && brand.logoUrl ? (
          <Image src={brand.logoUrl} style={styles.logo} />
        ) : (
          <View style={styles.monogramBox}>
            <Text style={styles.monogramText}>
              {(brand.name || 'C').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={isCentered ? { alignItems: 'center' } : undefined}>
          <Text style={styles.brandTitle}>{brand.name}</Text>
          {regParts.length > 0 && (
            <Text style={styles.brandSub}>{regParts.join(' | ')}</Text>
          )}
          {showAddress && brand.address && (
            <Text style={styles.brandSub}>{brand.address}</Text>
          )}
          <Text style={styles.brandSub}>Scope: {summary.shopLabel}</Text>
        </View>
      </View>

      <View style={isCentered ? styles.metaCentered : styles.metaRight}>
        <Text style={styles.reportTitle}>{title}</Text>
        <Text style={styles.metaText}>
          Period: {formatDate(summary.startDate)} to {formatDate(summary.endDate)}
        </Text>
        <Text style={styles.metaText}>Generated: {generatedAt}</Text>
      </View>
    </View>
  );
}

export function ItemWiseSummaryPdfDocument({
  summary,
  groups,
  includeDetails,
  generatedAt,
}: {
  summary: ItemWiseSummaryResult;
  groups: GroupedItemDetailsGroup[];
  includeDetails: boolean;
  generatedAt: string;
}) {
  const styles = createItemPdfStyles(summary.brand.primaryColor || '#ea580c');
  const topItem = summary.rows[0];

  return (
    <Document title={`${summary.brand.name} - Item-wise Summary Report`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <PdfBrandHeader
          summary={summary}
          title="Item-wise Summary Report"
          generatedAt={generatedAt}
          styles={styles}
        />

        {/* Summary KPI Cards */}
        <View style={styles.cardsContainer}>
          <View style={styles.cardHighlight}>
            <Text style={styles.cardLabel}>Total Amount</Text>
            <Text style={styles.cardValue}>{formatINR(summary.grandTotalAmount)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Distinct Items</Text>
            <Text style={styles.cardValue}>{formatCount(summary.rows.length)} items</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Purchases</Text>
            <Text style={styles.cardValue}>{formatCount(summary.grandTotalPurchases)} entries</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Top Item</Text>
            <Text style={styles.cardValue}>
              {topItem
                ? `${topItem.itemName}${topItem.unit ? ` (${topItem.unit})` : ''}`
                : 'None'}
            </Text>
          </View>
        </View>

        {/* Item-wise Summary Table */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Item-wise Summary</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Item</Text>
            <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Category</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>Total Qty</Text>
            <Text style={[styles.tableHeaderCell, { width: '16%', textAlign: 'right' }]}>Total Amount</Text>
            <Text style={[styles.tableHeaderCell, { width: '9%', textAlign: 'right' }]}>Count</Text>
            <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Avg Rate</Text>
            <Text style={[styles.tableHeaderCell, { width: '9%', textAlign: 'right' }]}>Share</Text>
          </View>

          {summary.rows.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '100%', color: '#6b7280' }]}>
                No item entries recorded for the selected filters.
              </Text>
            </View>
          ) : (
            summary.rows.map((row, idx) => (
              <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.tableCell, { width: '25%', fontFamily: 'Helvetica-Bold' }]}>
                  {row.itemName}
                  {row.unit ? ` (${row.unit})` : ''}
                </Text>
                <Text style={[styles.tableCell, { width: '14%', color: '#4b5563' }]}>
                  {row.category}
                </Text>
                <Text style={[styles.tableCellRight, { width: '15%' }]}>
                  {formatQuantityWithUnit(row.totalQuantity, row.unit)}
                </Text>
                <Text style={[styles.tableCellRight, { width: '16%', fontFamily: 'Helvetica-Bold' }]}>
                  {formatINR(row.totalAmount, false)}
                </Text>
                <Text style={[styles.tableCellRight, { width: '9%' }]}>
                  {formatCount(row.purchaseCount)}
                </Text>
                <Text style={[styles.tableCellRight, { width: '12%' }]}>
                  {row.avgRate !== null ? formatINR(row.avgRate, false) : '-'}
                </Text>
                <Text style={[styles.tableCellRight, { width: '9%' }]}>
                  {row.percentOfTotal.toFixed(1)}%
                </Text>
              </View>
            ))
          )}

          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableTotalCell, { width: '54%' }]}>GRAND TOTAL</Text>
            <Text style={[styles.tableTotalCellRight, { width: '16%' }]}>
              {formatINR(summary.grandTotalAmount)}
            </Text>
            <Text style={[styles.tableTotalCellRight, { width: '9%' }]}>
              {formatCount(summary.grandTotalPurchases)}
            </Text>
            <Text style={[styles.tableTotalCellRight, { width: '12%' }]}>-</Text>
            <Text style={[styles.tableTotalCellRight, { width: '9%' }]}>100%</Text>
          </View>
        </View>

        {/* Optional Section: Item-wise Details */}
        {includeDetails && groups.length > 0 && (
          <View break>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Item-wise Details (Day-by-Day Breakdown)</Text>
            </View>

            {groups.map((grp, gIdx) => (
              <View key={gIdx} style={{ marginBottom: 12 }} wrap={false}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 3 }}>
                  {grp.itemName}
                  {grp.unit ? ` (${grp.unit})` : ''} — {grp.category}
                </Text>
                <View style={styles.table}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, { width: '13%' }]}>Date</Text>
                    {summary.isAllShops && (
                      <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Shop</Text>
                    )}
                    <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Qty</Text>
                    <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Rate</Text>
                    <Text style={[styles.tableHeaderCell, { width: '13%', textAlign: 'right' }]}>Amount</Text>
                    <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Mode</Text>
                    <Text style={[styles.tableHeaderCell, { width: summary.isAllShops ? '14%' : '25%' }]}>Note</Text>
                    <Text style={[styles.tableHeaderCell, { width: summary.isAllShops ? '10%' : '15%' }]}>By</Text>
                  </View>

                  {grp.rows.slice(0, 60).map((r, rIdx) => (
                    <View key={rIdx} style={rIdx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                      <Text style={[styles.tableCell, { width: '13%' }]}>{r.dateFormatted}</Text>
                      {summary.isAllShops && (
                        <Text style={[styles.tableCell, { width: '16%' }]}>{r.shopName}</Text>
                      )}
                      <Text style={[styles.tableCellRight, { width: '12%' }]}>
                        {formatQuantityWithUnit(r.quantity, r.unit)}
                      </Text>
                      <Text style={[styles.tableCellRight, { width: '12%' }]}>
                        {r.unitPrice !== null ? formatINR(r.unitPrice, false) : '-'}
                      </Text>
                      <Text style={[styles.tableCellRight, { width: '13%' }]}>
                        {formatINR(r.amount, false)}
                      </Text>
                      <Text style={[styles.tableCell, { width: '10%' }]}>{r.modeName}</Text>
                      <Text style={[styles.tableCell, { width: summary.isAllShops ? '14%' : '25%', color: '#4b5563' }]}>
                        {r.note || '-'}
                      </Text>
                      <Text style={[styles.tableCell, { width: summary.isAllShops ? '10%' : '15%' }]}>
                        {r.enteredByName}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.tableTotalRow}>
                    <Text style={[styles.tableTotalCell, { width: summary.isAllShops ? '29%' : '13%' }]}>
                      Subtotal ({formatCount(grp.rows.length)} entries)
                    </Text>
                    <Text style={[styles.tableTotalCellRight, { width: '12%' }]}>
                      {formatQuantityWithUnit(grp.subtotalQuantity, grp.unit)}
                    </Text>
                    <Text style={[styles.tableTotalCellRight, { width: '12%' }]}>
                      {grp.avgRate !== null ? formatINR(grp.avgRate, false) : '-'}
                    </Text>
                    <Text style={[styles.tableTotalCellRight, { width: '13%' }]}>
                      {formatINR(grp.subtotalAmount)}
                    </Text>
                    <Text style={[styles.tableTotalCell, { width: summary.isAllShops ? '34%' : '50%' }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {summary.brand.pdfSignatureLine && (
          <View style={{ marginTop: 18, alignItems: 'flex-end' }}>
            <View
              style={{
                width: 170,
                borderTopWidth: 0.8,
                borderTopColor: '#9ca3af',
                paddingTop: 4,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 7.5, color: '#4b5563' }}>
                Authorized Signatory — {summary.brand.name}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {summary.brand.pdfFooterText
              ? `${summary.brand.pdfFooterText} • Powered by CafeLedger`
              : `${summary.brand.name} • Powered by CafeLedger`}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export function SingleItemDetailPdfDocument({
  summary,
  group,
  generatedAt,
}: {
  summary: ItemWiseSummaryResult;
  group: GroupedItemDetailsGroup;
  generatedAt: string;
}) {
  const styles = createItemPdfStyles(summary.brand.primaryColor || '#ea580c');
  const titleLabel = group.unit ? `${group.itemName} (${group.unit})` : group.itemName;

  return (
    <Document title={`${summary.brand.name} - ${titleLabel}`}>
      <Page size="A4" orientation="portrait" style={styles.page}>
        <PdfBrandHeader
          summary={summary}
          title={`Item Ledger: ${titleLabel}`}
          generatedAt={generatedAt}
          styles={styles}
        />

        <View style={styles.cardsContainer}>
          <View style={styles.cardHighlight}>
            <Text style={styles.cardLabel}>Total Amount</Text>
            <Text style={styles.cardValue}>{formatINR(group.subtotalAmount)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Quantity</Text>
            <Text style={styles.cardValue}>
              {formatQuantityWithUnit(group.subtotalQuantity, group.unit)}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Average Unit Price</Text>
            <Text style={styles.cardValue}>
              {group.avgRate !== null
                ? `${formatINR(group.avgRate)} / ${group.unit || 'unit'}`
                : '-'}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Purchases</Text>
            <Text style={styles.cardValue}>{formatCount(group.rows.length)} entries</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Purchases — {titleLabel}</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '13%' }]}>Date</Text>
            {summary.isAllShops && (
              <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Shop</Text>
            )}
            <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Quantity</Text>
            <Text style={[styles.tableHeaderCell, { width: '12%', textAlign: 'right' }]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>Amount</Text>
            <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Mode</Text>
            <Text style={[styles.tableHeaderCell, { width: summary.isAllShops ? '13%' : '24%' }]}>Note</Text>
            <Text style={[styles.tableHeaderCell, { width: summary.isAllShops ? '10%' : '15%' }]}>Entered By</Text>
          </View>

          {group.rows.map((r, idx) => (
            <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { width: '13%' }]}>{r.dateFormatted}</Text>
              {summary.isAllShops && (
                <Text style={[styles.tableCell, { width: '16%' }]}>{r.shopName}</Text>
              )}
              <Text style={[styles.tableCellRight, { width: '12%' }]}>
                {formatQuantityWithUnit(r.quantity, r.unit)}
              </Text>
              <Text style={[styles.tableCellRight, { width: '12%' }]}>
                {r.unitPrice !== null ? formatINR(r.unitPrice, false) : '-'}
              </Text>
              <Text style={[styles.tableCellRight, { width: '14%', fontFamily: 'Helvetica-Bold' }]}>
                {formatINR(r.amount, false)}
              </Text>
              <Text style={[styles.tableCell, { width: '10%' }]}>{r.modeName}</Text>
              <Text style={[styles.tableCell, { width: summary.isAllShops ? '13%' : '24%', color: '#4b5563' }]}>
                {r.note || '-'}
              </Text>
              <Text style={[styles.tableCell, { width: summary.isAllShops ? '10%' : '15%' }]}>
                {r.enteredByName}
              </Text>
            </View>
          ))}

          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableTotalCell, { width: summary.isAllShops ? '29%' : '13%' }]}>
              SUBTOTAL
            </Text>
            <Text style={[styles.tableTotalCellRight, { width: '12%' }]}>
              {formatQuantityWithUnit(group.subtotalQuantity, group.unit)}
            </Text>
            <Text style={[styles.tableTotalCellRight, { width: '12%' }]}>
              {group.avgRate !== null ? formatINR(group.avgRate, false) : '-'}
            </Text>
            <Text style={[styles.tableTotalCellRight, { width: '14%' }]}>
              {formatINR(group.subtotalAmount)}
            </Text>
            <Text style={[styles.tableTotalCell, { width: summary.isAllShops ? '33%' : '49%' }]} />
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {summary.brand.pdfFooterText
              ? `${summary.brand.pdfFooterText} • Powered by CafeLedger`
              : `${summary.brand.name} • Powered by CafeLedger`}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generateItemWisePdfReport(params: {
  summary: ItemWiseSummaryResult;
  groups: GroupedItemDetailsGroup[];
  includeDetails: boolean;
}): Promise<Buffer> {
  const generatedAt = formatDate(getTodayKolkata());
  const doc = (
    <ItemWiseSummaryPdfDocument
      summary={params.summary}
      groups={params.groups}
      includeDetails={params.includeDetails}
      generatedAt={generatedAt}
    />
  );
  const blob = await pdf(doc).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}

export async function generateSingleItemPdfReport(params: {
  summary: ItemWiseSummaryResult;
  group: GroupedItemDetailsGroup;
}): Promise<Buffer> {
  const generatedAt = formatDate(getTodayKolkata());
  const doc = (
    <SingleItemDetailPdfDocument
      summary={params.summary}
      group={params.group}
      generatedAt={generatedAt}
    />
  );
  const blob = await pdf(doc).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
