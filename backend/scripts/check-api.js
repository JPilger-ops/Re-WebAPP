import http from "http";

const host = process.env.CHECK_HOST || "192.200.255.225";
const port = Number(process.env.CHECK_PORT || process.env.PORT || 3031);
const path = process.env.CHECK_PATH || "/api/version";

console.log(`check:api -> http://${host}:${port}${path}`);

const req = http.get({ host, port, path }, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    if (res.statusCode === 200) {
      console.log("check:api OK", data);
      process.exit(0);
    } else {
      console.error("check:api FAIL", res.statusCode, data);
      process.exit(1);
    }
  });
});

req.on("error", (err) => {
  console.error("check:api error", err.message);
  process.exit(1);
});
