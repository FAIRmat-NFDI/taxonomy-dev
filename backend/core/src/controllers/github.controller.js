/** /github/* — forwards allowed GitHub REST calls on behalf of the signed-in (non-GitHub) user. */
export function createGitHubController({ services }) {
  const { githubProxy } = services;

  return {
    async proxy(req, res) {
      const out = await githubProxy.forward({
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        user: { login: req.session.login, name: req.session.name, providerLabel: req.session.providerLabel },
      });
      res.status(out.status).type(out.contentType).send(out.body);
    },
  };
}
