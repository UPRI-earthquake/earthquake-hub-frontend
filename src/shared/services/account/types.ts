export interface Profile {
  username: string;
  email: string;
  derivedRole: "brgy" | "citizen";
  rshakeEmailEnabled: boolean;
  passwordStatus: string;
  passwordPolicyVersion: number;
}