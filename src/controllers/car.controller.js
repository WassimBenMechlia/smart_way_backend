const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Car = require('../models/car.model');
const carsList = require('../constants/cars.json');
const APIFeatures = require('../utils/apiFeatures');

exports.getAllCarsModels = catchAsync(async (req, res, next) => {
  let cars = carsList;

  if (req.query.brand) {
    const brand = req.query.brand;
    // cars =
    //   cars.find(
    //     (car) =>
    //       car.name.toLowerCase() === brand.toLowerCase() ||
    //       car.id.toLowerCase() === brand.toLowerCase()
    //   )?.models || [];
    

    cars =
      carsList
        .find(
          (car) =>
            car.name.toLowerCase() === brand.toLowerCase() ||
            car.id.toLowerCase() === brand.toLowerCase()
        )
        ?.models.map((model) => model.name) || [];
  }

  if (req.query.brandOnly === true || req.query.brandOnly === 'true') {
    // cars = cars.map((car) => ({
    //   id: car.id,
    //   name: car.name,
    //   country: car.country,
    //   popular: car.popular,
    // }));
    cars = carsList.map((car) => car.name);
  }

  const count = cars.length;

  if (req.query.page && req.query.limit) {
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10;
    const skip = (page - 1) * limit;
    const end = page * limit;
    const total = cars.length;
    if (skip >= total) {
      return next(new AppError('This page does not exist', 404));
    }

    cars = cars.slice(skip, end);
  }

  return res.status(200).json({
    status: 'success',
    results: cars.length,
    count: count,
    data: cars,
  });
});

exports.getAllCars = catchAsync(async (req, res, next) => {
  const query = req.user.role === 'admin' ? {} : { user: req.user._id };

  const features = new APIFeatures(Car.find(query), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const cars = await features.query;

  return res.status(200).json({
    status: 'success',
    results: cars.length,
    data: cars,
  });
});

exports.createCar = catchAsync(async (req, res, next) => {
  const data = {
    ...req.body,
    user: req.user._id,
  };

  if (!data.brand) return next(new AppError('A car must have a brand', 400));
  if (!data.model) return next(new AppError('A car must have a model', 400));
  if (!data.color) return next(new AppError('A car must have a color', 400));

  const carBrand = carsList.find(
    (car) =>
      car.name.toLowerCase() === data.brand.toLowerCase() ||
      car.id.toLowerCase() === data.brand.toLowerCase()
  );
  if (!carBrand)
    return next(new AppError('This car brand does not exist', 400));

  const carModel = carBrand.models.find(
    (model) =>
      model.name.toLowerCase() === data.model.toLowerCase() ||
      model.id.toLowerCase() === data.model.toLowerCase()
  );
  if (!carModel)
    return next(new AppError('This car model does not exist', 400));

  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!hexColorRegex.test(data.color))
    return next(new AppError('This color is not valid', 400));
  console.log(data);
  const  lisenceplate= data.licensePlateNumber;
  const existingCar = await Car.findOne({ licensePlateNumber:lisenceplate });
  console.log(existingCar);
  
  if (existingCar) {
    // If the existing car has the same brand and model as well, it's considered an existing car
    if (existingCar.brand === data.brand && existingCar.model === data.model) {
      return next(new AppError('Car already exists', 400));
    } else {
      // If only the license plate matches, then it's an invalid license plate for a new car
      return next(new AppError('Invalid license plate', 400));
    }
  }
  const car = await Car.create(data);

  return res.status(201).json({
    status: 'success',
    data: car,
  });
});

exports.getCar = catchAsync(async (req, res, next) => {
  // Find the car by its ID
  const car = await Car.findById(req.params.id);

  // Check if the car exists
  if (!car) {
    return next(new AppError('No car found with that ID', 404));
  }
  
  // Check if the user is authorized to access the car
  if (
    req.user.role !== 'admin' &&
    car.user._id.toString() !== req.user._id.toString()
  ) {
    return next(new AppError('You are not allowed to access this car', 403));
  }

  return res.status(200).json({
    status: 'success',
    data: car,
  });
});

exports.updateCar = catchAsync(async (req, res, next) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    return next(new AppError('No car found with that ID', 404));
  }

  if (car.user._id.toString() !== req.user._id.toString()) {
    return next(new AppError('You are not allowed to access this car', 403));
  }

  const carToUpdate = Object.assign(car, req.body);

  const carBrand = carsList.find(
    (car) =>
      car.name.toLowerCase() === carToUpdate.brand.toLowerCase() ||
      car.id.toLowerCase() === carToUpdate.brand.toLowerCase()
  );

  if (!carBrand)
    return next(new AppError('This car brand does not exist', 400));

  const carModel = carBrand.models.find(
    (model) =>
      model.name.toLowerCase() === carToUpdate.model.toLowerCase() ||
      model.id.toLowerCase() === carToUpdate.model.toLowerCase()
  );

  if (!carModel)
    return next(new AppError('This car model does not exist', 400));

  // check if the updated color is a valid hex color code
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!hexColorRegex.test(carToUpdate.color))
    return next(new AppError('This color is not valid', 400));

  // update the car document and return the updated document
  const updatedCar = await Car.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  return res.status(200).json({
    status: 'success',
    data: updatedCar,
  });
});

exports.deleteCar = catchAsync(async (req, res, next) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    return next(new AppError('No car found with that ID', 404));
  }

  if (car.user._id.toString() !== req.user._id.toString()) {
    return next(new AppError('You are not allowed to access this car', 403));
  }

  await Car.deleteOne({ _id: req.params.id });

  return res.status(204).json({
    status: 'success',
    data: null,
  });
});
