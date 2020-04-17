import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import * as Yup from 'yup';
import { useLocation, useHistory } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import queryString from 'query-string';
import {
  FormHelperText,
  FormControlLabel,
  Button,
  Zoom,
  Card,
  FormGroup,
  Typography,
  Divider,
  Paper,
  Grid,
  TextField,
  Checkbox,
  Radio,
  Container,
  RadioGroup,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useFirestore, useUser } from 'reactfire';
import { activeCategoryMap } from 'constants/categories';
import { useNotifications } from 'modules/notification';
import {
  USERS_PRIVILEGED_COLLECTION,
  USERS_COLLECTION,
  REQUESTS_COLLECTION,
  REQUESTS_PUBLIC_COLLECTION,
  REQUESTS_CONTACT_INFO_COLLECTION,
  REQUESTS_ACTIONS_COLLECTION,
} from 'constants/collections';
import ClickableMap from 'components/ClickableMap';
import { GeoFirestore } from 'geofirestore';
import { REQUEST_SUCCESSFUL_PATH } from 'constants/paths';
import LoadingSpinner from 'components/LoadingSpinner';
import styles from './NewRequestPage.styles';

const useStyles = makeStyles(styles);

const requestValidationSchema = Yup.object().shape({
  firstName: Yup.string().required('Required').min(2, 'Too Short'),
  lastName: Yup.string().required('Required').min(2, 'Too Short'),
  immediacy: Yup.string().required('Please select the immediacy.'),
  needs: Yup.object().required('Please select at least one support need.'),
  phone: Yup.string().required('Required').min(2, 'Too Short'),
  email: Yup.string().email().min(2, 'Too Short'),
  otherComments: Yup.string(),
  needFinancialAssistance: Yup.string(),
});

function useNewRequestPage() {
  const history = useHistory();
  const firestore = useFirestore();
  const user = useUser();
  const { FieldValue, GeoPoint } = useFirestore;
  const { showSuccess, showError } = useNotifications();
  const [userLocation, setUserLocation] = useState(null);
  const [userLocationLoading, setLocationLoading] = useState(true);

  // Conditionally load Profile (only if current auth user exists)
  useEffect(() => {
    async function loadLatLongFromProfile() {
      // Set lat/long from user object if they exist
      if (user && user.uid) {
        const profileRef = firestore.doc(`${USERS_COLLECTION}/${user.uid}`);
        const profileSnap = await profileRef.get();
        const geopoint = profileSnap.get('preciseLocation');
        if (geopoint) {
          const { latitude, longitude } = geopoint;
          const newUserLocation = { latitude, longitude };
          const generalLocationName = profileSnap.get('preciseLocationName');
          if (generalLocationName) {
            newUserLocation.generalLocationName = generalLocationName;
          }
          setUserLocation(newUserLocation);
        }
        setLocationLoading(false);
      } else {
        setLocationLoading(false);
      }
    }
    // NOTE: useEffect is used to load data so it can be done conditionally based
    // on whether current user is logged in
    loadLatLongFromProfile();
  }, [user, firestore]);

  /**
   * Submit help request
   * @param {Object} values - Form values
   */
  async function submitRequest(values) {
    if (!userLocation) {
      alert('Please select a location by clicking on the map above.'); // eslint-disable-line no-alert
      return;
    }

    if (!user || !user.uid) {
      showError('You must be logged in to create a request');
      return;
    }

    const { lastName, phone, email, ...publicValues } = values;

    const requestPublicInfo = {
      ...publicValues,
      firstName: values.firstName,
      needFinancialAssistance: Boolean(values.needFinancialAssistance),
      immediacy: parseInt(values.immediacy, 10),
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      lastUpdatedAt: FieldValue.serverTimestamp(),
      status: 1,
      coordinates: new GeoPoint(
        /* eslint-disable no-underscore-dangle */
        userLocation.generalLocation._latitude,
        userLocation.generalLocation._longitude,
        /* eslint-enable no-underscore-dangle */
      ),
      generalLocationName: userLocation.generalLocationName,
    };

    // Convert needs to an array
    requestPublicInfo.needs = [];
    Object.keys(values.needs).forEach((item) => {
      if (values.needs[item]) {
        requestPublicInfo.needs.push(item);
      }
    });

    const requestContactInfo = {
      phone,
      email,
    };

    let userInfo = null;
    if (user && user.uid) {
      const userRef = firestore.doc(
        `${USERS_PRIVILEGED_COLLECTION}/${user.uid}`,
      );
      const profile = (await userRef.get()).data();
      // TODO: Test and verify after confirming the sign-in workflow.
      const pieces = user.displayName.split(' ');
      if (pieces.length < 2) {
        showError("Temporary name hack didn't work");
        return;
      }
      if (profile) {
        profile.displayName = user.displayName;
        [profile.firstName, profile.lastName] = pieces;

        userInfo = {
          userProfileId: user.uid,
          firstName: profile.firstName,
          displayName: profile.displayName,
        };
        requestPublicInfo.createdByInfo = userInfo;
      }
    }

    const requestPrivateInfo = {
      firstName: values.firstName,
      lastName: values.lastName,
      immediacy: values.immediacy,
      needs: values.needs,
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      preciseLocation: new GeoPoint(
        /* eslint-disable no-underscore-dangle */
        userLocation.preciseLocation._latitude,
        userLocation.preciseLocation._longitude,
        /* eslint-enable no-underscore-dangle */
      ),
    };
    /* eslint-disable no-console */
    console.log('Writing values to Firestore:', {
      requestPublicInfo,
      requestPrivateInfo,
      requestContactInfo,
    });
    /* eslint-enable no-console */

    try {
      const requestRef = await firestore
        .collection(REQUESTS_COLLECTION)
        .add(requestPrivateInfo);

      const action = {
        requestId: requestRef.id,
        action: 1, // 1-created
        createdAt: requestPublicInfo.createdAt,
        ...userInfo,
      };

      const geofirestore = new GeoFirestore(firestore);
      await Promise.all([
        geofirestore
          .collection(REQUESTS_PUBLIC_COLLECTION)
          .doc(requestRef.id)
          .set(requestPublicInfo),
        firestore
          .collection(REQUESTS_CONTACT_INFO_COLLECTION)
          .doc(requestRef.id)
          .set(requestContactInfo),
        firestore
          .collection(REQUESTS_ACTIONS_COLLECTION)
          .doc(requestRef.id)
          .set(action),
      ]);

      showSuccess('Request submitted!');
      history.replace(REQUEST_SUCCESSFUL_PATH);
    } catch (err) {
      showError(err.message || 'Error submitting request');
    }
  }
  /**
   * Update state and profile with location once selected in ClickableMap
   * @param {Object} newLocation - New location object from ClickableMap
   */
  async function handleLocationChange(newLocation) {
    // Set location to form
    setUserLocation(newLocation);
    // Update user profile with location selected for their request
    if (user.uid) {
      const {
        preciseLocation,
        generalLocationName: preciseLocationName,
      } = newLocation;
      await firestore.doc(`${USERS_COLLECTION}/${user.uid}`).set(
        {
          preciseLocation: new GeoPoint(
            /* eslint-disable no-underscore-dangle */
            preciseLocation._latitude,
            preciseLocation._longitude,
            /* eslint-enable no-underscore-dangle */
          ),
          preciseLocationName,
        },
        { merge: true },
      );
    }
  }
  return {
    submitRequest,
    handleLocationChange,
    userLocation,
    userLocationLoading,
  };
}

function NewRequestPage() {
  const classes = useStyles();
  const location = useLocation();
  const qs = queryString.parse(location.search);
  const defaultValues = { needs: {} };

  // Append needs from query string type
  if (qs && qs.type) {
    defaultValues.needs = { [qs.type]: true };
  }

  const {
    register,
    handleSubmit,
    errors,
    watch,
    control,
    formState: { isValid, isSubmitting, dirty },
  } = useForm({
    validationSchema: requestValidationSchema,
    defaultValues,
  });
  const {
    submitRequest,
    handleLocationChange,
    userLocation,
    userLocationLoading,
  } = useNewRequestPage();
  const currentNeeds = watch('needs');
  const groceryPickup = currentNeeds && currentNeeds['grocery-pickup'];
  // const hasFinancialComponent = true;

  return (
    <Container maxWidth="md">
      <Helmet>
        <title>Request Assistance</title>
      </Helmet>
      <Typography variant="h5" color="textPrimary" gutterBottom>
        Request Help
      </Typography>
      <Paper className={classes.paper} data-test="request-form">
        <div className={classes.heroContent}>
          <Container maxWidth="md">
            <form onSubmit={handleSubmit(submitRequest)}>
              {/* {console.log(errors)} */}
              <Container>
                <FormGroup>
                  <Typography
                    variant="h5"
                    gutterBottom
                    className={classes.otherComments}>
                    What do you need help with?
                  </Typography>
                  {Object.keys(activeCategoryMap).map((optionKey) => (
                    <FormControlLabel
                      key={optionKey}
                      control={
                        <Checkbox
                          inputRef={register}
                          name={`needs.${optionKey}`}
                          data-test={`need-${optionKey}`}
                          defaultChecked={defaultValues.needs[optionKey]}
                        />
                      }
                      label={
                        activeCategoryMap[optionKey].inputCaption
                          ? activeCategoryMap[optionKey].inputCaption
                          : activeCategoryMap[optionKey].description
                      }
                    />
                  ))}
                </FormGroup>
                {!!errors.needs && (
                  <FormHelperText error>{errors.needs.message}</FormHelperText>
                )}

                <Typography
                  variant="h5"
                  className={classes.otherComments}
                  gutterBottom={!groceryPickup}>
                  Details
                </Typography>
                <Zoom in={groceryPickup} unmountOnExit>
                  <Typography variant="subtitle1" gutterBottom>
                    For grocery pickup, please provide the list of groceries
                    that you would like the volunteer to get. Please be as
                    specific as possible.
                  </Typography>
                </Zoom>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      name="otherDetails"
                      data-test="otherDetails"
                      multiline
                      placeholder="Please be as specific as possible."
                      fullWidth
                      rows="4"
                      variant="outlined"
                      inputRef={register}
                    />
                  </Grid>
                </Grid>

                {/* <Zoom in={hasFinancialComponent} unmountOnExit> */}
                <div>
                  <Divider className={classes.optionalDivider} />
                  <Typography variant="h5" gutterBottom>
                    Will you be able to pay for your items?
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    This service is free, but the items still cost money. Are
                    you able to pay for your items? If not, we will do our best
                    to match you with organizations and volunteers who can also
                    provide financial assistance.
                  </Typography>
                  <Controller
                    as={
                      <RadioGroup
                        aria-label="Need Financial Assistance"
                        component="fieldset">
                        <FormControlLabel
                          value="true"
                          control={<Radio />}
                          label="Yes, I can pay and only need help with the delivery."
                        />
                        <FormControlLabel
                          value="false"
                          control={<Radio />}
                          label="No, I need help paying for the items."
                        />
                      </RadioGroup>
                    }
                    control={control}
                    onChange={([event]) => event.target.value}
                    name="needFinancialAssistance"
                    defaultValue="true"
                  />
                  {!!errors.needFinancialAssistance && (
                    <FormHelperText error>
                      {errors.needFinancialAssistance}
                    </FormHelperText>
                  )}
                </div>
                {/* </Zoom> */}

                <Divider className={classes.optionalDivider} />
                <Typography variant="h5" gutterBottom>
                  Immediacy of Need
                </Typography>
                <Typography variant="body1" gutterBottom>
                  Please let us know how urgently you need us to fulfill the
                  request. We will do our best to connect you with a volunteer
                  as soon as possible, however, we cannot guarantee anything
                  because we are dependent on volunteer availability.
                </Typography>
                <Controller
                  as={
                    <RadioGroup>
                      <FormControlLabel
                        value="1"
                        control={<Radio />}
                        label="Low"
                      />
                      <FormControlLabel
                        value="5"
                        control={<Radio />}
                        label="Medium - Not very urgent"
                      />
                      <FormControlLabel
                        value="10"
                        control={<Radio />}
                        label="High - Urgent"
                      />
                    </RadioGroup>
                  }
                  control={control}
                  name="immediacy"
                  defaultValue="2"
                />

                {!!errors.immediacy && (
                  <FormHelperText error>
                    {errors.immediacy.message}
                  </FormHelperText>
                )}
                {/* <Grid container spacing={3}>
                      <Grid item xs>
                        <Typography variant="body2" align="right" gutterBottom>
                          Very High
                        </Typography>
                      </Grid>
                      <Grid item xs={10}>
                        <FormControl component="fieldset">
                          <Field
                            as={RadioGroup}
                            name="radioNum"
                            row
                            onChange={handleChange}
                          >
                            {immediacyOptions.map((option, index) => (
                              <FormControlLabel
                                key={index}
                                className={classes.radio}
                                value={option}
                                control={<Radio />}
                                label={option}
                                labelPlacement="top"
                              />
                            ))}
                          </Field>
                        </FormControl>
                      </Grid>
                      <Grid item xs>
                        <Typography variant="body2" gutterBottom>
                          Very Low
                        </Typography>
                      </Grid>
                    </Grid> */}
                <Divider className={classes.optionalDivider} />
                <Typography variant="h5" gutterBottom>
                  Your Location
                </Typography>
                <Typography variant="body2" className={classes.intro}>
                  A rough location is needed to allow us to efficiently and
                  quickly find a match for your need. You can either click on
                  the &quot;Detect Location&quot; button below the map or click
                  on the map to specify the location.
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Card>
                      {userLocationLoading ? (
                        <LoadingSpinner />
                      ) : (
                        <ClickableMap
                          defaultLocation={userLocation}
                          onLocationChange={handleLocationChange}
                        />
                      )}
                    </Card>
                  </Grid>
                </Grid>
                <Divider className={classes.optionalDivider} />
                <Typography variant="h5" gutterBottom>
                  Contact Information
                </Typography>

                <Grid container spacing={2}>
                  <Grid item sm={12} md={6}>
                    <TextField
                      name="firstName"
                      data-test="firstName"
                      type="text"
                      label="First Name"
                      variant="outlined"
                      inputRef={register}
                      error={!!errors.firstName}
                      fullWidth
                      helperText={
                        errors && errors.firstName && errors.firstName.message
                      }
                    />
                  </Grid>
                  <Grid item sm={12} md={6}>
                    <TextField
                      name="lastName"
                      data-test="lastName"
                      type="text"
                      label="Last Name"
                      variant="outlined"
                      fullWidth
                      inputRef={register}
                      error={!!errors.lastName}
                      helperText={
                        errors && errors.firstName && errors.firstName.message
                      }
                    />
                  </Grid>
                  <Grid item sm={12} md={6}>
                    <TextField
                      name="phone"
                      data-test="phone"
                      type="text"
                      label="Phone Number"
                      variant="outlined"
                      fullWidth
                      inputRef={register}
                      error={!!errors.phone}
                      helperText={
                        errors && errors.phone && errors.phone.message
                      }
                    />
                  </Grid>
                  <Grid item sm={12} md={6}>
                    <TextField
                      name="email"
                      type="text"
                      data-test="email"
                      label="Email"
                      variant="outlined"
                      fullWidth
                      inputRef={register}
                      error={!!errors.email}
                      helperText={
                        errors && errors.email && errors.email.message
                      }
                    />
                  </Grid>
                </Grid>

                {dirty && Object.keys(dirty).length && !isValid && (
                  <Typography variant="body2" className={classes.errorText}>
                    Please fix the errors above.
                  </Typography>
                )}

                <div className={classes.buttons}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    data-test="submit-request"
                    disabled={isSubmitting}>
                    Submit Request
                  </Button>
                </div>
              </Container>
            </form>
          </Container>
        </div>
      </Paper>
    </Container>
  );
}

export default NewRequestPage;