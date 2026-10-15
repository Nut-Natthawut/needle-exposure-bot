export interface RichMenuDefinition {
  size: {width: number; height: number};
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: Array<{
    bounds: {x: number; y: number; width: number; height: number};
    action: {type: 'postback'; label: string; data: string};
  }>;
}
export function validateRichMenu(config: unknown, image: Buffer): asserts config is RichMenuDefinition;
export function menuVersion(config: RichMenuDefinition, image: Buffer): string;
export function installRichMenu(options: {
  config: RichMenuDefinition;
  image: Buffer;
  accessToken?: string;
  fetcher?: (url: string, init: RequestInit) => Promise<Response>;
}): Promise<{richMenuId: string; reused: boolean}>;
