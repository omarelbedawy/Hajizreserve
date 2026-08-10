const axios = require('axios');

const AIRLABS_BASE_URL = 'https://airlabs.co/api/v9/flight';

/**
 * Calls AirLabs for a given flight number (e.g. "BA117")
 * and returns { raw, delayMinutes, status }.
 *
 * raw          -> the full AirLabs response, saved as proof/evidence
 * delayMinutes -> departure delay in minutes (0 if on time / not found)
 * status       -> AirLabs' own status string, e.g. "scheduled", "en-route", "landed"
 */
async function getFlightStatus(flightIata) {
  const { data } = await axios.get(AIRLABS_BASE_URL, {
    params: {
      flight_iata: flightIata,
      api_key: process.env.AIRLABS_API_KEY,
    },
  });

  if (data.error) {
    throw new Error(data.error.message || 'Flight not found on AirLabs');
  }

  // AirLabs wraps the flight object in `data.response`
  const flight = data.response;

  if (!flight) {
    throw new Error(`No live flight data returned for ${flightIata}`);
  }

  const delayMinutes = flight.dep_delayed ?? flight.delayed ?? 0;

  return {
    raw: data,
    delayMinutes,
    status: flight.status || 'unknown',
  };
}

module.exports = { getFlightStatus };