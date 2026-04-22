import { queryClient } from "./queryClient";
import { insertTelegramAccountSchema, insertReportSchema, insertReportTemplateSchema, type TelegramAccount, type Report, type ReportTemplate } from "@shared/schema";
import { api as sharedApi, buildUrl } from "@shared/routes";

export const api = sharedApi;
export { buildUrl };

export const apiFetcher = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "An error occurred");
  }
  return response.json();
};
