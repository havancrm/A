// Which customer columns the app may change. Everything else is read-only here.
export const CUSTOMER_EDITABLE = [
  "name", "type", "address", "phone", "contactName", "paymentTerm", "lineId", "email",
  "keepNote", "customerNote", "specialConditions", "storeHours", "visitCycleDays",
  "gpsLat", "gpsLng", "mapLink", "owner", "area", "activeFlag",
  "taxInvoiceRequired", "taxName", "taxAddress", "taxBranch", "taxId", "receiptRequired",
];
