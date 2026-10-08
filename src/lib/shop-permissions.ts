/**
 * The ONE Owner / Manager / Staff matrix (hatiwal-mobile docs/SHOPS.md
 * "Brought into 1.1.6", api 76ca115). Every screen asks this instead of
 * comparing roles itself; the API enforces the same table (ShopPolicy).
 */
export type ShopMemberRole = "owner" | "manager" | "staff";

export type ShopAction =
  | "editShop" // name, logo, cover, hours, address, phone
  | "manageInvites" // invite, cancel, resend, see pending invites
  | "removeStaff"
  | "removeManager"
  | "changeRole"
  | "transfer"
  | "closeShop"
  | "applyVerified"
  | "leave";

const MATRIX: Record<ShopAction, ShopMemberRole[]> = {
  editShop: ["owner", "manager"],
  manageInvites: ["owner", "manager"],
  removeStaff: ["owner", "manager"],
  removeManager: ["owner"],
  changeRole: ["owner"],
  transfer: ["owner"],
  closeShop: ["owner"],
  // Owner decision, 2026-10-08: the owner or a manager applies, with their own
  // e-Tazkira. Staff never see the card or the page.
  applyVerified: ["owner", "manager"],
  // The owner transfers first.
  leave: ["manager", "staff"],
};

export function shopCan(role: string | null | undefined, action: ShopAction): boolean {
  return !!role && (MATRIX[action] as string[]).includes(role);
}

/** May `role` remove a member whose role is `target`? Nobody removes the owner. */
export function canRemoveMember(role: string | null | undefined, target: string): boolean {
  if (target === "owner") return false;
  return shopCan(role, target === "manager" ? "removeManager" : "removeStaff");
}
