import { Link } from "react-router-dom";
import { useAuth } from "@/store/AuthContext";

export function ProfilePage() {
  const { user } = useAuth();

  return (
      <div className="col-md-9">
        <div className="tab-content dashboard-content">
          <div className="tab-pane fade active show" id="dashboard" role="tabpanel" aria-labelledby="dashboard-tab">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Hello {user?.name}! </h5>
              </div>
              <div className="card-body">
                <p>
                  From your account dashboard, you can easily check &amp; view your{" "}
                  <b>
                    {" "}
                    <Link to="/orders">recent orders</Link>
                  </b>
                  , manage your <Link to="/Address">shipping and billing addresses</Link>, and{" "}
                  <Link to="/AccountDetails">edit your password and account details</Link>.
                </p>
                <br />
                <p>E-mail : {user?.email}</p>
                <p>Phone : {user?.phone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
