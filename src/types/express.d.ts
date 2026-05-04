declare module "express-serve-static-core" {
  interface Request {
    /** Telegram user id после `requireTelegramAuth` на `/api/platform/*`. */
    platformTelegramId?: string;
  }
}

export {};
