import { describe, expect, it } from "vitest";
import { isPicture, isReceiptKey, receiptContentType, receiptKey, receiptProblem } from "./receipts";

const id = "0b7f2c1e-4a5d-4e8f-9a1b-2c3d4e5f6a7b";

describe("Receipts", () => {
  it("are photos or PDFs of up to 10 MB", () => {
    expect(receiptProblem({ contentType: "application/pdf", size: 1000 })).toBeNull();
    expect(receiptProblem({ contentType: "image/jpeg", size: 10 * 1024 * 1024 })).toBeNull();
    expect(receiptProblem({ contentType: "image/jpeg", size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
    expect(receiptProblem({ contentType: "text/plain", size: 10 })).toMatch(/photos and PDFs/);
    expect(receiptProblem({ contentType: "image/png", size: 0 })).toMatch(/empty/);
  });

  it("are stored under their own keys", () => {
    expect(receiptKey(id, "image/jpeg")).toBe(`money/receipts/${id}.jpg`);
    expect(isReceiptKey(receiptKey(id, "application/pdf"))).toBe(true);
    expect(isReceiptKey(`clips/${id}.mp4`)).toBe(false);
    expect(isReceiptKey(`money/receipts/../${id}.jpg`)).toBe(false);
  });

  it("know their type from the extension when the phone sends none", () => {
    expect(receiptContentType({ type: "", name: "Factura.PDF" })).toBe("application/pdf");
    expect(receiptContentType({ type: "", name: "IMG_1.jpeg" })).toBe("image/jpeg");
    expect(receiptContentType({ type: "image/png", name: "x" })).toBe("image/png");
    expect(receiptContentType({ type: "text/plain", name: "a.txt" })).toBe("text/plain");
  });

  it("show as pictures only when a browser can", () => {
    expect(isPicture("image/jpeg")).toBe(true);
    expect(isPicture("image/heic")).toBe(false);
    expect(isPicture("application/pdf")).toBe(false);
  });
});
