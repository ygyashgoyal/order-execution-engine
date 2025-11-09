import { startServer, stopServer } from "../src/app";
import { orderQueue } from "../src/queue/orderQueue";

jest.setTimeout(30000);

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

beforeAll(async () => {
  await startServer(4000);
});

afterAll(async () => {
  await stopServer();
  try {
    await orderQueue.close();
  } catch {}
});
