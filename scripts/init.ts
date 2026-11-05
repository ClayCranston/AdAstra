import { db } from "../src/lib/db";
db().close();
console.log("Local database is ready.");
