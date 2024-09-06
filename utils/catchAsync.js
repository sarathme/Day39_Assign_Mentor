exports.catchAsync = (fn) => {
  return (req, res, next) => {
    console.log("Entered global error handler");
    fn(req, res, next).catch(next);
  };
};
