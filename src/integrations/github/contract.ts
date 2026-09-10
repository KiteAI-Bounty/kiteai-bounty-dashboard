export interface GithubIdentity {
  id: string;
  login: string;
  avatarUrl: string;
}
export interface GithubRepository {
  id: string;
  url: string;
  owner: string;
  name: string;
  isFork: boolean;
  defaultBranch: string;
}
export interface GithubReadProvider {
  getIdentity(accessToken: string): Promise<GithubIdentity>;
  getRepository(owner: string, name: string): Promise<GithubRepository>;
}
