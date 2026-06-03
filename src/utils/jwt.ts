import jwt from "jsonwebtoken";
import { TokenPayloadType } from "../types/tokenpayload.types";

const JWT_SECRET = process.env.JWT_SECRET || "my_super_secret_jwt_token";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "my_super_secret_jwt_refresh_token";

export const generateAccessToken = (payload: TokenPayloadType): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
};

export const generateRefreshToken = (payload: TokenPayloadType): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

export const verifyAccessToken = (token: string): TokenPayloadType => {
  return jwt.verify(token, JWT_SECRET) as TokenPayloadType;
};

export const verifyRefreshToken = (token: string): TokenPayloadType => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayloadType;
};
