import { Switch, Route, Router as WouterRouter } from "wouter";
import AddProduct from "@/pages/AddProduct";
import Shop from "@/pages/Shop";
import TryOn from "@/pages/TryOn";
import Settings from "@/pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AddProduct} />
      <Route path="/shop" component={Shop} />
      <Route path="/tryon" component={TryOn} />
      <Route path="/settings" component={Settings} />
      <Route>
        <div style={{ padding: 40, textAlign: "center", fontFamily: "'Noto Sans', sans-serif" }}>
          <h2>404 — Page not found</h2>
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter>
      <Router />
    </WouterRouter>
  );
}
