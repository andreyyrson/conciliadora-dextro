import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login"
  }
})

export const config = {
  matcher: [
    "/conciliacoes/:path*",
    "/upload/:path*",
    "/empresas/:path*",
    "/importar/:path*"
  ]
}
