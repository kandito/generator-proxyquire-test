'use strict';

const _ = require('lodash');
const abTesting = require('@cermati/ab');
const Bluebird = require('bluebird');
const logger = require('@cermati/cermati-utils/logger')(__filename);
const moment = require('moment');
const router = require('route-label');
const { HttpError } = require('@cermati/cermati-utils/http/error');

const errorHandler = require('../../../config/error');
const helpers = require('../helpers');
const travelInsuranceQuery = require('../queries/travelInsurance');
const cloudinaryHelpers = require('../../common/helpers/cloudinary');
const dataLayer = require('../../common/helpers/dataLayer');
const commonHelpers = require('../../../modules/common/helpers/url/index');

const promiseHelpers = require('../../common/helpers/promise');
const adwordsHelper = require('../../../modules/common/helpers/adwords');
const applicationHelper = require('../../../modules/application/helpers/application');
const couponHelpers = require('../../payment/helpers/coupon');

const applicationQuery = require('../../../modules/application/queries/application');
const couponQueries = require('../../../modules/payment/queries/coupon');

const constants = require('../../../utils/constants');
const { COUPON_TYPE } = require('../../../modules/payment/utils/constants');
const { OTHER_FEE_LIST } = require('../utils/constants');
/**
 * Controller to show travel insurance detail
 *
 * @author Christian <ctarunajaya@cermati.com>
 * @param {Request} req - Request object
 * @param {Result} res - Result object
 * @param {Function} nextMiddleware - Next middleware to be called when this controller isn't an endpoint
 */
module.exports = (req, res, nextMiddleware) => {
  // A/B Testing
  if (req.experiment.variation === 'INACTIVE') {
    return errorHandler.handle404(req, res);
  }

  const locals = res.locals;
  locals.useNewBreadcrumb = true;

  const slug = req.params.slug;
  const query = req.query;
  const currentFilters = helpers.sanitizeDetailParams(query);

  const queryString = req.baseUrl + req.url;
  const queryObject = commonHelpers.getQueryStringObj(queryString);

  // const landingPageUrl = router.urlFor('travelInsurance.index');

  const listingParams = [
    'destinationType', 'destination', 'totalDays', 'policyType', 'coveragePersonType', 'departureDate', 'age'
  ];
  const listingPageParams = _.pick(currentFilters, listingParams);
  listingPageParams.travelDuration = currentFilters.totalDays;

  locals.listingUrl = router.urlFor('travelInsurance.list', {coveragePersonType: currentFilters.coveragePersonType}, listingPageParams);

  locals.detailUrl = router.urlFor('travelInsurance.detail', {
    slug: slug
  }, queryObject);

  // Hide Footer &  Navigation Menu
  locals.hideFooter = true;
  locals.hideNavigationMenu = true;

  // CSS class name for this page
  locals.page.className = 'travel-insurance';
  locals.page.description = req.__('page.travelInsurance.description');
  locals.page.title = req.__('page.travelInsurance.title');
  locals.section = 'insurance';
  locals.subsection = 'travel-insurance';
  locals.initials.errorAjax = req.__('error.ajax');

  locals.pageBreadcrumbs = {
    title: {label: 'Checkout', needI18N: false}
  };

  // Set upsale flag
  locals.isNotUpsale = _.get(req.query, 'upsale') !== '1';

  // For frontend stuff to call simulate
  locals.initials.destinationType = currentFilters.destinationType;
  locals.initials.destination = currentFilters.destination;
  locals.initials.coveragePersonType = currentFilters.coveragePersonType;
  locals.initials.age = currentFilters.age;
  locals.initials.policyType = currentFilters.policyType;
  locals.initials.departureDate = currentFilters.departureDate;
  locals.initials.totalDays = currentFilters.totalDays;
  locals.initials.packageSlug = currentFilters.packageSlug;

  locals.paymentData = [];

  let couponParams;

  // Process simulate result
  const onGetProductDetail = (product, flowExperiment) => {
    if (_.isEmpty(product)) {
      return Bluebird.reject('route');
    }

    if (!_.isNil(flowExperiment)) {
      locals.flowExperiment = {
        name: 'INSURANCE_FLOW',
        variation: flowExperiment.variationCodename
      };
    }

    product.image = cloudinaryHelpers.convertUrltoCloudinaryObject(_.get(product, 'imageUrl', ''), 'travel-insurance');
    product.name = product.productName;

    locals.product = product;

    // Set button tracker
    locals.trackers = {
      applyButtonName: constants.TRACK_BUTTONS.travelInsurance.checkout.apply,
      cancelButtonName: constants.TRACK_BUTTONS.travelInsurance.checkout.cancel,
      noPerilButtonName: constants.TRACK_BUTTONS.travelInsurance.checkout.noPeril
    };

    couponParams = {
      email: _.get(req, 'user.email', 'not-logged-in'),
      productType: constants.APPLICATION.productTypes.travelInsurance,
      productId: locals.product.productId
    };

    return product;
  };

  // Process product options
  const onGetProductOptions = product => {
    // Build product options
    let productOptions = {
      age: _.get(currentFilters, 'age'),
      coveragePersonType: _.get(currentFilters, 'coveragePersonType'),
      departureDate: _.get(currentFilters, 'departureDate'),
      destination: _.get(currentFilters, 'destination'),
      destinationType: _.get(currentFilters, 'destinationType'),
      packageSlug: _.get(currentFilters, 'packageSlug'),
      policyType: _.get(currentFilters, 'policyType'),
      totalDays: _.get(currentFilters, 'totalDays')
    };

    // Change date format for front end sake
    locals.departureDate = moment(productOptions.departureDate, 'DD/MM/YYYY').format('MM/DD/YYYY');

    // Assign productOptions and application data to frontend
    locals.productOptions = _.extend(productOptions, adwordsHelper.getAdwordsTrackingInfo(req.cookies));
    locals.initials.applicationListUrl = router.urlFor('me.applications');

    // Add premium, payment total and discount amount if exist
    locals.productOptions.usdToIdrValue = _.ceil(Number(_.get(product, ['calculationResult', 'usdToIdrValue'], 0)));
    locals.productOptions.paymentPremium = Number(_.get(product, ['calculationResult', 'paymentPremium'], 0));
    locals.productOptions.paymentTotal = Number(_.get(product, ['calculationResult', 'paymentTotal'], 0));
    locals.productOptions.paymentTotalWithDiscount = Number(_.get(product, ['calculationResult', 'paymentTotalWithDiscount'], 0));
    locals.productOptions.discountPercentage = Number(_.get(product, 'discountPercentage', 0));
    locals.productOptions.discountAmount = Number(_.get(product, 'discountAmount', 0));

    if (!locals.productOptions.discountAmount && locals.productOptions.paymentTotalWithDiscount) {
      // If discount amount not found, but payment total with discount found.
      locals.productOptions.discountAmount = locals.productOptions.paymentTotal - locals.productOptions.paymentTotalWithDiscount;
    }

    locals.tagLayer = dataLayer[constants.PAGE_TYPE.travelInsurance.checkout](locals.product, locals.productOptions, '', constants.CHECKOUT_STEP.checkout, locals.flowExperiment);

    return Bluebird.resolve();
  };

  // Process coupon code
  const fetchCoupon = () => {
    locals.hasPercentageCoupon = false;

    if (!req.query.couponCode) {
      return Bluebird.resolve();
    }

    locals.couponCode = locals.productOptions.couponCode = req.query.couponCode;

    if (!locals.isNotUpsale && !_.startsWith(locals.couponCode, '-')) {
      locals.productOptions.couponCode = `-${locals.couponCode}`;
    }

    return couponQueries.validateCouponByCode(locals.productOptions.couponCode, couponParams)
      .then((couponValidationResult) => {
        if (!couponValidationResult || !_.get(couponValidationResult, 'success', true)) {
          locals.couponErrorMessage = _.get(couponValidationResult, 'error') || req.__('payment.error.invalidCoupon');
          _.unset(locals.productOptions, 'couponCode');
          return Bluebird.resolve();
        }

        const coupon = couponValidationResult;
        let couponValue = _.get(coupon, 'value', 0);
        const couponDiscountCoverages = _.get(coupon, 'discountCoverages');

        if (!_.isEmpty(coupon.configs)) {
          const couponConfigs = couponHelpers.filterCouponConfigsByProduct(coupon.configs, locals.product.productId, constants.APPLICATION.productTypes.travelInsurance);
          const eligibleCoupon = couponHelpers.findEligibleCoupon(couponConfigs, locals.productOptions.paymentTotal);

          if (_.isEmpty(eligibleCoupon)) {
            logger.warn(
              'No eligible coupon found with amount "%s", productId "%s", productType "%s" for coupon: %s',
              locals.productOptions.paymentTotal,
              locals.product.productId,
              constants.APPLICATION.productTypes.travelInsurance,
              JSON.stringify(coupon, null, 2)
            );

            locals.couponErrorMessage = req.__('payment.error.invalidCoupon');
            _.unset(locals.productOptions, 'couponCode');

            return Bluebird.resolve();
          }

          couponValue = _.get(eligibleCoupon, 'value', 0);
          coupon.value = couponValue;
        }

        if (coupon.type === COUPON_TYPE.percentage) {
          locals.hasPercentageCoupon = true;

          const discountCoupon = couponHelpers.calculatePercentageCouponValue(couponValue, couponDiscountCoverages, _.get(locals.product, 'calculationResult'), false);

          locals.productOptions.discountCoupon = discountCoupon;
          locals.productOptions.paymentTotalWithDiscount -= discountCoupon;
          locals.productOptions.discountCouponPercentage = Number(couponValue);
        } else if (coupon.type === COUPON_TYPE.fixed) {
          locals.productOptions.discountCoupon = Number(couponValue);
          locals.productOptions.paymentTotalWithDiscount -= Number(couponValue);
        } else if (coupon.type === COUPON_TYPE.static) {
          locals.productOptions.discountCouponDescription = couponValue;
        }

        return Bluebird.resolve();
      })
      .catch((err) => {
        // Just log error and unset coupon code, continue checkout process without coupon.
        _.unset(locals.productOptions, 'couponCode');
        logger.error(err.message || err);
      });
  };

  // Process beneficiary data
  const createBeneficiaryData = () => {
    const selectedPackage = _.first(locals.product.Packages);

    const coveragesInDb = _.get(selectedPackage, 'Coverages', []);
    let selectedCoverages = {};
    let travelInsuranceBeneficiaries = [];

    if (!_.isEmpty(coveragesInDb)) {
      selectedCoverages = helpers.sanitizeExtraCoverage(query, coveragesInDb);
    }

    // Create data for main-policy-holder
    let mainTravelInsuranceBeneficiaryData = [{
      orderId: '',
      selectedCoverages: selectedCoverages,
      paymentData: {
        adminFee: _.get(locals.product, ['calculationResult', 'adminFee'], 0),
        paymentPremium: _.get(locals.product, ['calculationResult', 'paymentPremium'], 0),
        paymentTotal: _.get(locals.product, ['calculationResult', 'paymentTotal'], 0),
        stampFee: _.get(locals.product, ['calculationResult', 'stampFee'], 0),
      },
      insuredPerson: '',
      name: _.get(req, 'user.fullName', ''),
      gender: _.get(req, 'user.gender', ''),  // TODO: Need to define where the gender for main insurer will come from
      age: _.get(locals.productOptions.age, 0),
      relationshipToUser: 'main',

      // Will be used someday
      partnerId: '',
      policyId: '',

      packageId: selectedPackage.packageId,
      packageName: selectedPackage.packageName,
      packageSlug: selectedPackage.packageSlug,
      minAgeInYears: selectedPackage.minAgeInYears,
      maxAgeInYears: selectedPackage.maxAgeInYears,
      price: Number(_.get(selectedPackage, 'price', 0)),
      discountPercentage: _.get(locals.product, ['calculationResult', 'discountPercentage'], 0),
      discountAmount: _.get(locals.product, ['calculationResult', 'discountAmount'], 0)
    }];

    if (currentFilters.additionalInsurer) {
      const additionalInsurerObject = _.first(currentFilters.additionalInsurer);

      // Individual or Group coveragePersonType querystring array
      let additionalInsurerAges = _.get(additionalInsurerObject, 'age');
      let additionalInsurerNames = _.get(additionalInsurerObject, 'insurerName');

      // Family coveragePersonType querystring array
      let additionalInsurerTypes = _.get(additionalInsurerObject, 'type');
      let additionalInsurerGenders = _.get(additionalInsurerObject, 'gender');

      // Set all value to array if it's not (we assume every query object has same length)
      if (!_.isArray(additionalInsurerAges)) {
        additionalInsurerAges = [additionalInsurerAges];
        additionalInsurerNames = [additionalInsurerNames];
        additionalInsurerTypes = [additionalInsurerTypes];
        additionalInsurerGenders = [additionalInsurerGenders];
      }

      // Only show prices for additional insurer if coveragePersonType is not Family
      locals.showPrices = selectedPackage.coveragePersonType !== 'family';

      // Iterate through all additional insurer and push it to travelInsuranceBeneficiaries array
      _.each(additionalInsurerAges, (additionalInsurerAge, index) => {
        const additionalTravelInsuranceBeneficiaryData = {
          orderId: '',
          selectedCoverages: selectedCoverages,
          paymentData: _.get(locals.product, ['calculationResult', `paymentAdditionalInsurer${index + 1}`], {}),
          insuredPerson: '',
          name: additionalInsurerNames[index],
          gender: _.get(additionalInsurerGenders, index, ''),
          age: _.get(additionalInsurerAges, index, 0),
          relationshipToUser: _.get(additionalInsurerTypes, index, ''),

          // Will be used someday
          partnerId: '',
          policyId: '',

          packageId: selectedPackage.packageId,
          packageName: selectedPackage.packageName,
          packageSlug: selectedPackage.packageSlug,
          minAgeInYears: selectedPackage.minAgeInYears,
          maxAgeInYears: selectedPackage.maxAgeInYears,
          price: Number(_.get(selectedPackage, 'price', 0)),
          discountPercentage: _.get(locals.product, ['calculationResult', 'discountPercentage'], 0),
          discountAmount: _.get(locals.product, ['calculationResult', 'discountAmount'], 0)
        };

        // If there is any invalid additional insurer, just ignore it
        if (_.inRange(_.floor(additionalInsurerAge), selectedPackage.minAgeInYears, selectedPackage.maxAgeInYears + 1)) {
          travelInsuranceBeneficiaries.push(additionalTravelInsuranceBeneficiaryData);
        }
      });
    }

    _.each(travelInsuranceBeneficiaries, (travelInsuranceBeneficiary, index) => {
      // Create payment data for main-policy-holder
      locals.paymentData.push({
        name: `Additional Insurer ${index + 1}`,
        price: Number(_.get(travelInsuranceBeneficiary, ['paymentData', 'paymentTotal'], 0)),
        id: `additional-insurer-${index + 1}`,
        quantity: 1
      });
    });

    locals.otherFees = [];

    _.each(OTHER_FEE_LIST, (otherFeeLabel) => {
      const otherFee = _.get(locals.product, ['calculationResult', otherFeeLabel]);

      if (otherFee) {
        const otherFeeObject = {
          name: req.__(`travelInsurance.terms.${otherFeeLabel}`),
          price: Number(otherFee),
          id: otherFeeLabel,
          quantity: 1,
        };

        locals.otherFees.push(otherFeeObject);
        locals.paymentData.push(otherFeeObject);
      }
    });

    locals.travelInsuranceBeneficiaries = _.concat(mainTravelInsuranceBeneficiaryData, travelInsuranceBeneficiaries);

    return Bluebird.resolve();
  };

  const renderTemplate = () => res.render('travelInsurance/templates/checkout');

  return Bluebird.all([
    travelInsuranceQuery.fetchTravelInsuranceSimulation(slug, query, false),
    abTesting.getVariation(req.session.id, 'INSURANCE_FLOW')
  ])
    .spread(onGetProductDetail)
    .then(onGetProductOptions)
    .then(createBeneficiaryData)
    .then(fetchCoupon)
    .then(() => {
      let productOptions = {};
      // We need convert all values to string before send to API sales lead save.
      _.each(locals.productOptions, (value, key) => {
        productOptions[key] = _.toString(value);
      });

      const discountAmount = Number(_.get(productOptions, 'discountAmount', 0));
      const discountCoupon = Number(_.get(productOptions, 'discountCoupon', 0));
      locals.hasDiscount = discountAmount || discountCoupon || locals.hasPercentageCoupon;

      const applicationData = {
        name: _.get(req, 'user.fullName', ''),
        email: _.get(req, 'user.email', ''),
        city: _.get(req, 'user.residenceCity', ''),
        phoneNumber: _.get(req, 'user.mobilePhone', ''),
        product: locals.product.productName,
        productId: locals.product.productSlug,
        productType: constants.APPLICATION.productTypes.travelInsurance,
        productImage: JSON.stringify(locals.product.image),
        institution: locals.product.insurerName,
        url: router.absoluteUrlFor('travelInsurance.detail', {
          slug: slug
        }, req.query),
        productOptions: productOptions,
        couponCode: locals.productOptions.couponCode,
        selectedCoverages: currentFilters.selectedCoverages,
        paymentData: locals.paymentData,
        travelInsuranceBeneficiaries: locals.travelInsuranceBeneficiaries,
        leadSource: req.cookies.leadsource
      };

      if (req.method === 'POST') {
        // If post method, create application data
        // and hit API save sales lead
        var options = {
          logError: true // Useful when testing, printing validation errors as log
        };

        if (req.session.stagingUser) {
          options.stagingUser = req.session.stagingUser;
        }

        return applicationQuery.fetchSimilarApplication(applicationData)
          .then(result => {
            if (!_.isNil(result.inProcessApplication) && !_.endsWith(req.user.email, '@cermati.com')) {
              var rejectUrl = router.absoluteUrlFor(
                'travelInsurance.rejectDuplicate',
                {slug: locals.product.productSlug},
                req.query
              );

              return res.status(200)
                .send({status: true, data: {nextStepUrl: rejectUrl}});
            }

            return applicationHelper.createApplication(applicationData, options)
              .catch((error) => {
                // Error from save sales lead
                logger.error('Error', error, 'Application Data:', JSON.stringify(applicationData));
                const status = _.get(error, 'cause.status') || 500;

                return Bluebird.reject(new HttpError(_.get(error, 'response.body'), {
                  status: status
                }));
              })
              .then((result) => {
                const responseBody = result.body;
                let task = Bluebird.resolve();
                const orderId = _.get(responseBody, 'data.orderId');

                // Use coupon
                if (locals.productOptions.couponCode) {
                  const couponCode = locals.productOptions.couponCode;
                  const params = _.assign({}, couponParams, {
                    orderId: orderId
                  });
                  task = couponQueries.useCouponByCode(couponCode, params)
                    .catch((err) => {
                      logger.warn('Application created with invalid coupon code. Order ID', orderId, err);
                    });
                }

                // Application created and coupon used if exist.
                return task
                  .then(() => {
                    const isPaymentHandledByCermati = _.get(locals.product, 'isPaymentHandledByCermati', true);

                    if (locals.flowExperiment && _.get(locals.flowExperiment, 'variation') === 'PAYMENT_FIRST' && isPaymentHandledByCermati) {
                      const paymentUrl = router.urlFor('payment.initiate', {
                        orderId: responseBody.data.orderId
                      });

                      responseBody.data.nextStepUrl = router.urlFor('session.signIn', null, {
                        target: paymentUrl
                      });
                    }

                    return res.status(200)
                      .send(responseBody);
                  });
              });
          });
      } else {
        // Set variable that used in template
        locals.discountCoupon = _.get(locals.productOptions, 'discountCoupon', 0);
        locals.paymentPremium = locals.productOptions.paymentPremium;
        locals.paymentTotal = locals.productOptions.paymentTotal;
        locals.paymentTotalWithDiscount = locals.productOptions.paymentTotalWithDiscount;
        locals.discountAmount = locals.productOptions.discountAmount;

        locals.travelInsuranceBeneficiaries = _.filter(locals.travelInsuranceBeneficiaries, travelInsuranceBeneficiary => {
          return travelInsuranceBeneficiary.relationshipToUser !== 'main';
        });

        locals.beneficiaryCount = locals.travelInsuranceBeneficiaries.length;

        // Render checkout page if req.method is GET
        return renderTemplate();
      }
    })
    .catch(HttpError, promiseHelpers.createHttpErrorHandler(logger, res))
    .catch(nextMiddleware);
};
