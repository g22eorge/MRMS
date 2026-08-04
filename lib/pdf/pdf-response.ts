/** Standard response for generated PDF buffers. Pass `inline` for in-app preview iframes; default downloads. */
export function pdfAttachmentResponse(buffer: Buffer | Uint8Array, filename: string, inline = false) {
  const bytes = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  return new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
    },
  });
}

export function pdfGenerationErrorResponse(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

/** Map generator errors to HTTP status codes for job document routes. */
export function jobPdfErrorStatus(message: string): number {
  if (/not found/i.test(message)) return 404;
  if (/only be generated|only after|read-only|disabled until/i.test(message)) {
    return /read-only|disabled until/i.test(message) ? 402 : 409;
  }
  if (/forbidden/i.test(message)) return 403;
  return 500;
}
