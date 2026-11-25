// CSS order matches the original app: base styles, Bootstrap, then the two stylesheets
// (both were global in the CRA build, so they are global here too).
import "@/styles/globals.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "@/styles/SignUp.css";
import "@/styles/Dashboard.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Inventory Management",
  description: "Inventory and component tracking",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="App">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
