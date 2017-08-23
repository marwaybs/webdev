<!DOCTYPE html>
<html>
  <head>
    <title>Token Generation php script</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.5.1/css/bulma.css"/>
  </head>
  <body>
    <p><?php echo "Token Generation Sample <br />";
    $DEV_KEY = "rUlaMASgt1Byi4Kp3sKYDeQzo" ; 			// Copy your dev key from vidyo.io dashboard
    $APP_ID = "77dc6e.vidyo.io" ;    // Copy your app Id from vidyo.io dashboard
    $username = "bsmarway@gmail.com" ; 			// Username, hard coded for debug purposes
    $expiresInSecs = 1000 ; 		// Generated token will expire after these many seconds

	// time() by default subtracts datetime(1970, 1, 1) from the datetime
	// on which we call it, therefore the number of seconds is smaller
	// by (pseudocode!) seconds("1970-01-01").
	// In Erlang, on the other hand, we get the actual number of seconds,
	// hence we adjust for this difference here.
	// IMPORTANT! A 64bit architecture is assumed! Otherwise, the timestamp
	// might be stored as a 32bit integer, therefore limiting the "capacity"
	// to 2038 (see https://en.wikipedia.org/wiki/Year_2038_problem).
    $EPOCH_SECONDS = 62167219200 ;
    $expires = $EPOCH_SECONDS + $expiresInSecs + time();

    echo "<br />" ;
    echo "Developer key" . "\t" ."\t" ."\t" . ":" . $DEV_KEY . "<br />" ;
    echo "App ID          : " . $APP_ID . "<br />" ;
    echo "Username        : " . $username . "<br />" ;
    echo "Expires         : " . date("F j, Y, g:i a", $expiresInSecs + time()) . "<br />" ;

    $jid = $username . "@" . $APP_ID ;
    //echo "JID: " . $jid . "<br />" ;

    // Must place \0 within double quotes, not single quotes.
    $body = "provision" . "\0" . $jid . "\0" . $expires . "\0" . "" ;
    echo "BODY: " . $body . "<br />" ;

    // Important to convert to UTF8. I found this is what made the difference.
    $utf8_body = utf8_encode( $body ) ;
    echo "UTF8 BODY: " . $utf8_body . "<br />" ;

    // Ensure the SHA384 Algo is being used.
    $mac_hash = hash_hmac( "sha384", $utf8_body, $DEV_KEY ) ;
    echo "HMAC (384): " . $mac_hash . "<br />" ;

    // Again, ensure \0 are encapsulated with double quotes. Single quotes does not append the null character to the string
    $serialized = $utf8_body . "\0" . $mac_hash ;
    echo "SERIALIZED: " . $serialized . "<br />" ;

    // Base64 Encode the serialized string
    $b64_encoded = base64_encode( $serialized ) ;
    echo "<br /> B64 ENCODED TOKEN :<br /><br />" . $b64_encoded . "<br />" ;
?></p>
  </body>
</html>
