import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login"
  }
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/conciliacoes/:path*",
    "/contas/:path*",
    "/upload/:path*",
    "/empresas/:path*"
  ]
}
