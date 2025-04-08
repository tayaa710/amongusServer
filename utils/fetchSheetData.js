import axios from 'axios';

const sheetId = "1g3Esmr1-Z5jt5_mqOv9-f9fvyFezgT_2Z-8G7w5ChSU";

export const fetchSingleSheet = async (gid, index) => {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}`;
  const response = await axios.get(url);
  const text = response.data;
  const json = JSON.parse(text.substring(47).slice(0, -2));

  const rows = json.table.rows;
  const cols = json.table.cols;

  const formattedData = rows.map((row) => {
    const obj = {};
    row.c.forEach((cell, i) => {
      const key = cols[i].label.toLowerCase().replace(/\s+/g, "");
      obj[key] = cell?.v ?? "";
    });
    return obj;
  });

  return { sheet: index, data: formattedData };
};

export const fetchSheetData = async () => {
  const gids = [
    "0",
    "783570152",
    "1053703173",
    "554027446",
    "1583768346",
    "1320392700"
  ];

  const allData = await Promise.all(gids.map((gid, index) => fetchSingleSheet(gid, index)));
  return allData;
};
