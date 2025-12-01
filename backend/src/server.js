import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import testRoutes from "./routes/test.routes.js";
import customerRoutes from "./routes/customer.routes.js"; // NEU
import { authRequired } from "./middleware/auth.middleware.js";
import userRoutes from "./routes/user.routes.js";
import roleRoutes from "./routes/role.routes.js";
import categoryRoutes from "./routes/category.routes.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use((req, res, next) => {
  res.removeHeader("WWW-Authenticate");
  next();
});

/* -------------------------
   🔧 MIDDLEWARES (MÜSSEN ZUERST!)
-------------------------- */
app.use(cors({
  origin: "http://192.200.255.225",
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

/* -------------------------
   📁 STATIC FILES
-------------------------- */
app.use(express.static(path.join(__dirname, "../public")));

/* -------------------------
   🚀 API ROUTES
-------------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/invoices", authRequired, invoiceRoutes);
app.use("/api/customers", authRequired, customerRoutes);
app.use("/api/testdb", authRequired, testRoutes);
app.use("/api/categories", categoryRoutes);

/* -------------------------
   🌐 FRONTEND ROUTE
-------------------------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
export default app;