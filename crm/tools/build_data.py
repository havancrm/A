"""Build crm/data/data.js from the raw Google Sheets exports in crm/data/source/.

Run:  python3 crm/tools/build_data.py

Inputs (raw Sheets get_values JSON, {"range": ..., "values": [[...], ...]}):
  crm/data/source/customers.json   customers!A1:AD
  crm/data/source/bills.json       bills!A1:M
  crm/data/source/bill_items.json  bill_items!A1:G

Output:
  crm/data/data.js  (window.CRM_DATA = {...}); contains customer personal data,
  so crm/data/ is listed in .gitignore and must not be committed.
"""
import json
import os
from collections import defaultdict
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
SRC = os.path.join(DATA, "source")
OUT = os.path.join(DATA, "data.js")
TODAY = date.today()


def load_rows(name):
    with open(os.path.join(SRC, name + ".json"), encoding="utf-8") as f:
        values = json.load(f)["values"]
    header = values[0]
    rows = []
    for raw in values[1:]:
        padded = raw + [""] * (len(header) - len(raw))
        rows.append(dict(zip(header, padded)))
    return rows


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def days_since(iso):
    try:
        d = date.fromisoformat(iso[:10])
        return (TODAY - d).days
    except (TypeError, ValueError):
        return None


def bill_type(total, items):
    if total < 0:
        return "คืนสินค้า"
    if total == 0:
        codes = {i["code"] for i in items}
        if codes & {"0019", "0023", "0001"}:
            return "เปลี่ยนสินค้า/ค้างส่ง"
        return "ศูนย์บาท"
    return "ขาย"


def main():
    customers_raw = load_rows("customers")
    bills_raw = load_rows("bills")
    items_raw = load_rows("bill_items")

    items_by_bill = defaultdict(list)
    for r in items_raw:
        if not r.get("billNo"):
            continue
        items_by_bill[r["billNo"]].append({
            "line": r["line"], "code": r["code"], "name": r["name"],
            "qty": num(r["qty"]), "price": num(r["price"]), "amount": num(r["amount"]),
        })

    bills = []
    for r in bills_raw:
        if not r.get("no"):
            continue
        items = items_by_bill.get(r["no"], [])
        total = num(r["total"])
        bills.append({
            "no": r["no"], "date": r["date"], "customerId": r["customerId"],
            "customerName": r["customerName"], "subtotal": num(r["subtotal"]),
            "vat": num(r["vat"]), "total": total, "paymentTerm": r["paymentTerm"],
            "openedBy": r["openedBy"], "salesperson": r["salesperson"],
            "vatMode": r["vatMode"], "type": bill_type(total, items), "items": items,
        })
    bills.sort(key=lambda b: (b["date"], b["no"]))

    stats = defaultdict(lambda: {"count": 0, "sales": 0.0, "last": ""})
    for b in bills:
        s = stats[b["customerId"]]
        s["count"] += 1
        if b["type"] == "ขาย":
            s["sales"] += b["total"]
        if b["date"] > s["last"]:
            s["last"] = b["date"]

    customers = []
    for r in customers_raw:
        if not r.get("id"):
            continue
        cid = r["id"]
        s = stats.get(cid, {"count": 0, "sales": 0.0, "last": ""})
        lat, lng = r.get("gpsLat", ""), r.get("gpsLng", "")
        customers.append({
            "id": cid,
            "name": r["name"], "type": r["type"], "address": r["address"],
            "phone": r["phone"], "contactName": r["contactName"],
            "paymentTerm": r["paymentTerm"], "billClerk": r["billClerk"],
            "owner": r.get("owner", "") or "",
            "activeFlag": r["activeFlag"],
            "lat": num(lat) if lat else None, "lng": num(lng) if lng else None,
            "visitCycleDays": num(r["visitCycleDays"]) if r["visitCycleDays"] else None,
            "lineId": r["lineId"], "email": r["email"],
            "keepNote": r["keepNote"], "customerNote": r["customerNote"],
            "specialConditions": r["specialConditions"], "storeHours": r["storeHours"],
            "taxInvoiceRequired": r["taxInvoiceRequired"], "taxName": r["taxName"],
            "taxAddress": r["taxAddress"], "taxBranch": r["taxBranch"], "taxId": r["taxId"],
            "receiptRequired": r["receiptRequired"],
            "billCount": s["count"], "totalSales": round(s["sales"], 2),
            "lastBillDate": s["last"] or None,
            "daysSinceLastBill": days_since(s["last"]) if s["last"] else None,
        })

    # Product catalog: codes that appear in bills, with the latest name seen.
    # The full products sheet (438 rows) is not included yet; see README.
    catalog = {}
    for b in bills:
        for it in b["items"]:
            if it["price"] > 0 and it["code"] not in ("0019", "0023", "0001"):
                catalog[it["code"]] = {"code": it["code"], "name": it["name"], "lastPrice": it["price"]}
    catalog.setdefault("BLUK-1028", {"code": "BLUK-1028", "name": "ผลิตภัณฑ์ถูพื้น Standard 5 ลิตร", "lastPrice": 285})

    out = {
        "generatedAt": TODAY.isoformat(),
        "customers": customers,
        "bills": bills,
        "products": sorted(catalog.values(), key=lambda p: p["code"]),
    }
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("window.CRM_DATA = ")
        json.dump(out, f, ensure_ascii=False)
        f.write(";\n")
    print(f"customers={len(customers)} bills={len(bills)} products={len(catalog)} -> {OUT}")


DEMO_OUT = os.path.join(DATA, "..", "demo", "index.html")


def anonymize(out):
    """Replace personal fields so the data can be shared for testing."""
    order = {c["id"]: i + 1 for i, c in enumerate(out["customers"])}
    blank = ["email", "lineId", "keepNote", "customerNote", "taxName", "taxAddress",
             "taxBranch", "taxId", "contactName", "specialConditions"]
    for c in out["customers"]:
        n = order[c["id"]]
        c["name"] = "ลูกค้าทดสอบ %04d" % n
        c["address"] = "ที่อยู่ทดสอบ เขต %d" % (n % 50 + 1)
        c["phone"] = "081-000-%04d" % n if c["phone"] else ""
        for k in blank:
            c[k] = ""
        if c["lat"] is not None:
            c["lat"], c["lng"] = 13.7563 + (n % 50) * 0.002, 100.5018 + (n % 50) * 0.002
    for b in out["bills"]:
        b["customerName"] = "ลูกค้าทดสอบ %04d" % order.get(b["customerId"], 0)
    return out


def build_demo(out):
    """Write one self-contained HTML file (anonymized data inlined)."""
    anon = anonymize(json.loads(json.dumps(out)))
    with open(os.path.join(HERE, "..", "index.html"), encoding="utf-8") as f:
        html = f.read()
    tag = '<script src="data/data.js"></script>'
    if tag not in html:
        raise SystemExit("index.html no longer loads data/data.js; update build_demo")
    payload = "<script>window.CRM_DATA = " + json.dumps(anon, ensure_ascii=False) + ";</script>"
    os.makedirs(os.path.dirname(DEMO_OUT), exist_ok=True)
    with open(DEMO_OUT, "w", encoding="utf-8") as f:
        f.write(html.replace(tag, payload))
    print("demo ->", os.path.normpath(DEMO_OUT))


if __name__ == "__main__":
    import sys
    main()
    if "--demo" in sys.argv:
        with open(OUT, encoding="utf-8") as f:
            text = f.read()
        build_demo(json.loads(text[len("window.CRM_DATA = "):].rstrip().rstrip(";")))
