function zeroFillEntryId(id) {
  return String(id).padStart(7, "0");
}

export { zeroFillEntryId };