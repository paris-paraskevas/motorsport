// The account seam's browser half (PA A1): the Account every file reads instead of the provider's user. A1a declares the
// type alone, which the server half imports as a type; A1b adds the provider, useAccount, SignInLink and SignOutButton.

/** A signed-in person as the site reads them, the same on the server and in the browser. */
export interface Account {
  /** The app's id for the person, the value every user column of every table holds: Clerk's user id today; after the
   *  switch (A3) an imported account keeps it as its legacy id and a new account's id is its Supabase id. Never handed to a
   *  provider's admin call as the provider's own id once the two can differ. */
  id: string;
  /** The primary address; null when the provider holds none. */
  email: string | null;
  /** The full name, else first and last; null when neither is set. */
  name: string | null;
  username: string | null;
  /** A photo the person uploaded; null otherwise (Clerk serves a generated placeholder for everyone, so only its hasImage tells). */
  imageUrl: string | null;
  /** The role when set: admin, moderator, writer or contributor (lib/threads.ts reads the ladders). */
  role: string | null;
  /** The supporter flag an admin sets when a donation arrives. */
  donor: boolean;
}
