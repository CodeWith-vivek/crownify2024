const User=require("../models/userSchema")
const userCheck = async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ blocked: false, loggedOut: true });
    }

    const user = await User.findById(req.session.user);
    if (user && user.isBlocked) {
      req.session.destroy(); // Destroy session to log out the user
      return res.json({ blocked: true });
    }

    res.json({ blocked: false });
  } catch (error) {
    console.error("Error checking block status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
module.exports={
    userCheck,
}

const generateSalesReport = async (req, res) => {
  const { type, startDate, endDate } = req.body;

  try {
    let query = {};
    const today = new Date();

    // Filter based on report type
    switch (type) {
      case "daily":
        query.orderedAt = {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lte: new Date(today.setHours(23, 59, 59, 999)),
        };
        break;
      case "weekly":
        const startOfWeek = new Date();
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date();
        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
        query.orderedAt = {
          $gte: startOfWeek,
          $lte: endOfWeek,
        };
        break;
      case "monthly":
        query.orderedAt = {
          $gte: new Date(today.getFullYear(), today.getMonth(), 1),
          $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
        };
        break;
      case "yearly":
        query.orderedAt = {
          $gte: new Date(today.getFullYear(), 0, 1),
          $lte: new Date(today.getFullYear(), 11, 31),
        };
        break;
      case "custom":
        // Validate and parse dates
        if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
          return res
            .status(400)
            .json({ status: false, message: "Invalid date range" });
        }
        query.orderedAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
        break;
      default:
        return res
          .status(400)
          .json({ status: false, message: "Invalid report type" });
    }

    // Fetch orders based on the query
    const orders = await Order.find(query);

    // Prepare data for the chart
    const labels = []; // This will hold the labels for the chart
    const revenue = []; // This will hold the revenue data
    const orderCounts = []; // This will hold the order counts

    // Calculate totals based on the timeframe
    if (type === "daily") {
      labels.push(today.toLocaleDateString());
      revenue.push(
        orders.reduce((total, order) => total + order.grandTotal, 0)
      );
      orderCounts.push(orders.length);
    } else if (type === "weekly") {
      for (let i = 0; i < 7; i++) {
        const day = new Date();
        day.setDate(today.getDate() - today.getDay() + i);
        labels.push(day.toLocaleDateString());
        const dailyOrders = orders.filter((order) => {
          const orderDate = new Date(order.orderedAt);
          return orderDate.toDateString() === day.toDateString();
        });
        revenue.push(
          dailyOrders.reduce((total, order) => total + order.grandTotal, 0)
        );
        orderCounts.push(dailyOrders.length);
      }
    } else if (type === "monthly") {
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        labels.push(i.toString());
        const dailyOrders = orders.filter((order) => {
          const orderDate = new Date(order.orderedAt);
          return (
            orderDate.getDate() === i &&
            orderDate.getMonth() === today.getMonth() &&
            orderDate.getFullYear() === today.getFullYear()
          );
        });
        revenue.push(
          dailyOrders.reduce((total, order) => total + order.grandTotal, 0)
        );
        orderCounts.push(dailyOrders.length);
      }
    } else if (type === "yearly") {
      for (let i = 0; i < 12; i++) {
        const month = new Date(today.getFullYear(), i);
        labels.push(month.toLocaleString("default", { month: "long" }));
        const monthlyOrders = orders.filter((order) => {
          const orderDate = new Date(order.orderedAt);
          return (
            orderDate.getFullYear() === today.getFullYear() &&
            orderDate.getMonth() === i
          );
        });
        revenue.push(
          monthlyOrders.reduce((total, order) => total + order.grandTotal, 0)
        );
        orderCounts.push(monthlyOrders.length);
      }
    }

    // Send the response in the required format
    return res.json({
      status: true,
      [type]: {
        labels,
        revenue,
        orders: orderCounts,
      },
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};