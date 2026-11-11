export function currentUser(req, res) {
  const { _id, name, email, role } = req.user;
  res.set('Cache-Control', 'no-store').json({ user: { id: _id.toString(), name, email, role } });
}
