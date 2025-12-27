import React from "react";
import PropTypes from "prop-types";

const DashboardLayout = ({ desktop, mobile }) => (
  <>
    <div className="hidden md:block w-full max-w-screen lg:max-w-full mx-auto px-3 py-8">{desktop}</div>
    <div className="md:hidden w-full px-3 py-6 space-y-5">{mobile}</div>
  </>
);

DashboardLayout.propTypes = {
  desktop: PropTypes.node.isRequired,
  mobile: PropTypes.node.isRequired,
};

export default DashboardLayout;
