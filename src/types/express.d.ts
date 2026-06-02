import { TokenPayloadType } from "../utils/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayloadType;
    }
  }
}
