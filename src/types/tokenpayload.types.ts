export interface TokenPayloadType {
  userId: string;
  email: string;
  role: "ADMIN" | "STAFF";
}
